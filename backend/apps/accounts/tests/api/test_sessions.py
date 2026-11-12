import datetime as dt

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import DeviceSession
from apps.common.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _reset_throttle():
    cache.clear()


@pytest.fixture
def user():
    u = UserFactory(email="dev@test.com")
    u.set_password("testpass123")
    u.save()
    return u


def login(user, name=None):
    body = {"email": user.email, "password": "testpass123"}
    if name:
        body["device_name"] = name
    return APIClient().post("/api/v1/auth/token/", body).data


def as_token(access):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return c


def test_login_creates_session_with_sid_claim(user):
    tokens = login(user, "Meu PC")
    s = DeviceSession.objects.get(user=user)
    assert s.device_name == "Meu PC"
    assert RefreshToken(tokens["refresh"])["sid"] == s.id
    assert as_token(tokens["access"]).get("/api/v1/auth/me/").status_code == 200


def test_login_without_device_name_uses_default(user):
    login(user)
    assert DeviceSession.objects.get().device_name == "Dispositivo"


def test_two_logins_create_two_sessions(user):
    login(user, "A")
    login(user, "A")
    assert DeviceSession.objects.filter(user=user).count() == 2


def test_revoked_session_blocks_access_and_refresh_only_for_that_session(user):
    a, b = login(user, "A"), login(user, "B")
    sid_a = RefreshToken(a["refresh"])["sid"]
    sid_b = RefreshToken(b["refresh"])["sid"]
    resp = as_token(b["access"]).delete(f"/api/v1/auth/sessions/{sid_a}/")
    assert resp.status_code == 204
    assert as_token(a["access"]).get("/api/v1/auth/me/").status_code == 401
    assert (
        APIClient()
        .post("/api/v1/auth/token/refresh/", {"refresh": a["refresh"]})
        .status_code
        == 401
    )
    assert as_token(b["access"]).get("/api/v1/auth/me/").status_code == 200
    ok = APIClient().post("/api/v1/auth/token/refresh/", {"refresh": b["refresh"]})
    assert ok.status_code == 200
    assert RefreshToken(ok.data["refresh"])["sid"] == sid_b


def test_is_current_only_on_token_session(user):
    a, b = login(user, "A"), login(user, "B")
    data = as_token(a["access"]).get("/api/v1/auth/sessions/").data
    sid_a = RefreshToken(a["refresh"])["sid"]
    assert {s["device_name"]: s["is_current"] for s in data} == {"A": True, "B": False}
    assert [s["id"] for s in data][1] == sid_a  # mais recente primeiro
    assert b


def test_revoke_other_users_session_is_404(user):
    other = DeviceSession.objects.create(user=UserFactory(), device_name="x")
    t = login(user)
    resp = as_token(t["access"]).delete(f"/api/v1/auth/sessions/{other.id}/")
    assert resp.status_code == 404
    assert "detail" in resp.data


def test_logout_revokes_session_even_without_refresh(user):
    t = login(user, "A")
    c = as_token(t["access"])
    assert c.post("/api/v1/auth/logout/", {}).status_code == 205
    assert DeviceSession.objects.get().revoked is True
    assert c.get("/api/v1/auth/me/").status_code == 401


def test_token_without_sid_still_valid(user):
    access = str(RefreshToken.for_user(user).access_token)
    assert as_token(access).get("/api/v1/auth/me/").status_code == 200


def test_last_seen_not_rewritten_within_a_minute(user):
    t = login(user, "A")
    s = DeviceSession.objects.get()
    old = timezone.now() - dt.timedelta(hours=1)
    DeviceSession.objects.filter(pk=s.pk).update(last_seen_at=old)
    c = as_token(t["access"])
    c.get("/api/v1/auth/me/")
    first = DeviceSession.objects.get().last_seen_at
    assert first > old
    c.get("/api/v1/auth/me/")
    assert DeviceSession.objects.get().last_seen_at == first


def test_logout_without_refresh_creates_no_outstanding_token(user):
    t = login(user, "A")
    before = OutstandingToken.objects.count()
    assert as_token(t["access"]).post("/api/v1/auth/logout/", {}).status_code == 205
    assert OutstandingToken.objects.count() == before


def test_logout_non_object_body_is_400(user):
    t = login(user, "A")
    resp = as_token(t["access"]).post("/api/v1/auth/logout/", [1], format="json")
    assert resp.status_code == 400


def test_refresh_without_sid_is_401(user):
    refresh = str(RefreshToken.for_user(user))
    resp = APIClient().post("/api/v1/auth/token/refresh/", {"refresh": refresh})
    assert resp.status_code == 401


def test_revoking_own_session_invalidates_same_access(user):
    t = login(user, "A")
    sid = RefreshToken(t["refresh"])["sid"]
    c = as_token(t["access"])
    assert c.delete(f"/api/v1/auth/sessions/{sid}/").status_code == 204
    assert c.get("/api/v1/auth/me/").status_code == 401


@pytest.mark.parametrize("refresh", [None, ""])
def test_logout_accepts_null_or_blank_refresh(user, refresh):
    t = login(user, "A")
    resp = as_token(t["access"]).post(
        "/api/v1/auth/logout/", {"refresh": refresh}, format="json"
    )
    assert resp.status_code == 205
    assert DeviceSession.objects.get().revoked is True
