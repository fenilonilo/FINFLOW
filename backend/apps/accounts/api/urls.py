from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.api.views import (
    AvatarView,
    DeviceSessionListView,
    DeviceSessionRevokeView,
    LoginView,
    LogoutView,
    MeView,
    RegisterView,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/token/", LoginView.as_view(), name="auth-token"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("auth/me/avatar/", AvatarView.as_view(), name="auth-me-avatar"),
    path("auth/sessions/", DeviceSessionListView.as_view(), name="auth-sessions"),
    path(
        "auth/sessions/<int:pk>/",
        DeviceSessionRevokeView.as_view(),
        name="auth-session-revoke",
    ),
]
