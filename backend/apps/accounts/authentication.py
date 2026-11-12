from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer


class SessionJWTAuthentication(JWTAuthentication):
    """Sid revogado/inexistente e rejeitado; access sem sid (legado) passa."""

    def authenticate(self, request):
        # import tardio: services -> common.exceptions importa rest_framework.views
        from apps.accounts.services import SessionService

        result = super().authenticate(request)
        if result:
            user, token = result
            sid = token.get("sid")
            if sid is not None and not SessionService.validate_and_touch(sid, user.id):
                raise AuthenticationFailed("Sessão encerrada.", code="session_revoked")
        return result


class SessionTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        from apps.accounts.services import SessionService

        sid = self.token_class(attrs["refresh"]).get("sid")
        if sid is None or not SessionService.is_active(sid):
            raise InvalidToken("Sessão encerrada.")
        return super().validate(attrs)


class SessionJWTScheme(OpenApiAuthenticationExtension):
    target_class = "apps.accounts.authentication.SessionJWTAuthentication"
    name = "jwtAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
