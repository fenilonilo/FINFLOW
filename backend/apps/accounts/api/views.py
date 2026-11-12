from django.contrib.auth import authenticate
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.api.serializers import (
    AvatarUploadSerializer,
    DeviceSessionSerializer,
    LoginSerializer,
    LogoutSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    TokenPairSerializer,
    UserSerializer,
)
from apps.accounts.repositories import DeviceSessionRepository
from apps.accounts.services import ProfileService, SessionService
from apps.common.exceptions import NotFoundError


def _current_sid(request) -> int | None:
    return request.auth.get("sid") if request.auth else None


class RegisterView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=RegisterSerializer, responses={201: UserSerializer})
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=LoginSerializer, responses=TokenPairSerializer)
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = authenticate(request, username=data["email"], password=data["password"])
        if not user:
            return Response(
                {"detail": "Credenciais inválidas."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        session = SessionService.start(user, data.get("device_name", ""))
        refresh = RefreshToken.for_user(user)
        refresh["sid"] = session.id
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=LogoutSerializer, responses={205: None})
    def post(self, request):
        data = LogoutSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        if refresh := data.validated_data.get("refresh"):
            try:
                RefreshToken(refresh).blacklist()
            except TokenError:
                pass
        sid = _current_sid(request)
        if sid is not None:
            SessionService.revoke(request.user, sid)
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(request=ProfileUpdateSerializer, responses=UserSerializer)
    def patch(self, request):
        data = ProfileUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = ProfileService.update(request.user, **data.validated_data)
        return Response(UserSerializer(user).data)


class AvatarView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    @extend_schema(request=AvatarUploadSerializer, responses=UserSerializer)
    def post(self, request):
        user = ProfileService.set_avatar(request.user, request.FILES.get("avatar"))
        return Response(UserSerializer(user).data)

    @extend_schema(request=None, responses={204: None})
    def delete(self, request):
        ProfileService.clear_avatar(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeviceSessionListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=DeviceSessionSerializer(many=True))
    def get(self, request):
        sessions = DeviceSessionRepository.list_active(request.user)
        ctx = {"sid": _current_sid(request)}
        return Response(DeviceSessionSerializer(sessions, many=True, context=ctx).data)


class DeviceSessionRevokeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        parameters=[OpenApiParameter("pk", int, OpenApiParameter.PATH)],
        responses={204: None},
    )
    def delete(self, request, pk):
        if not SessionService.revoke(request.user, pk):
            raise NotFoundError("Session not found.")
        return Response(status=status.HTTP_204_NO_CONTENT)
