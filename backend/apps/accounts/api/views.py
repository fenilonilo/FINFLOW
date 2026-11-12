from django.contrib.auth import authenticate
from drf_spectacular.utils import extend_schema
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
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
)
from apps.accounts.models import DeviceSession
from apps.accounts.services import ProfileService


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        if not user:
            return Response(
                {"detail": "Credenciais inválidas."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        device_name = serializer.validated_data.get("device_name", "")
        if device_name:
            DeviceSession.objects.get_or_create(user=user, device_name=device_name)

        refresh = RefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data.get("refresh"))
            token.blacklist()
        except (TokenError, KeyError):
            pass
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

    def get(self, request):
        sessions = DeviceSession.objects.filter(user=request.user, revoked=False)
        return Response(DeviceSessionSerializer(sessions, many=True).data)


class DeviceSessionRevokeView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            session = DeviceSession.objects.get(pk=pk, user=request.user)
            session.revoked = True
            session.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DeviceSession.DoesNotExist:
            return Response(
                {"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND
            )
