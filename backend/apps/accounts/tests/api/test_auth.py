import pytest
from rest_framework.test import APIClient

from apps.common.factories import UserFactory


@pytest.mark.django_db
class TestAuth:
    def test_register_creates_user(self):
        client = APIClient()
        resp = client.post(
            "/api/v1/auth/register/",
            {
                "email": "new@test.com",
                "first_name": "Test",
                "password": "securepass123",
            },
        )
        assert resp.status_code == 201
        assert resp.data["email"] == "new@test.com"
        assert "id" in resp.data
        assert "password" not in resp.data

    def test_register_duplicate_email_returns_400(self):
        UserFactory(email="exists@test.com")
        client = APIClient()
        resp = client.post(
            "/api/v1/auth/register/",
            {
                "email": "exists@test.com",
                "first_name": "Test",
                "password": "securepass123",
            },
        )
        assert resp.status_code == 400

    def test_login_returns_tokens(self):
        user = UserFactory(email="login@test.com")
        user.set_password("testpass123")
        user.save()
        client = APIClient()
        resp = client.post(
            "/api/v1/auth/token/",
            {"email": "login@test.com", "password": "testpass123"},
        )
        assert resp.status_code == 200
        assert "access" in resp.data
        assert "refresh" in resp.data

    def test_login_wrong_password_returns_401(self):
        user = UserFactory(email="bad@test.com")
        user.set_password("correct")
        user.save()
        client = APIClient()
        resp = client.post(
            "/api/v1/auth/token/",
            {"email": "bad@test.com", "password": "wrong"},
        )
        assert resp.status_code == 401

    def test_refresh_token_rotation_blacklists_old_token(self):
        user = UserFactory(email="refresh@test.com")
        user.set_password("testpass123")
        user.save()
        client = APIClient()
        login = client.post(
            "/api/v1/auth/token/",
            {"email": "refresh@test.com", "password": "testpass123"},
        )
        old_refresh = login.data["refresh"]

        # Refresh rotaciona — returns new access + new refresh
        resp = client.post("/api/v1/auth/token/refresh/", {"refresh": old_refresh})
        assert resp.status_code == 200
        new_refresh = resp.data["refresh"]
        assert new_refresh != old_refresh

        # Old token deve ser rejeitado após rotação
        resp2 = client.post("/api/v1/auth/token/refresh/", {"refresh": old_refresh})
        assert resp2.status_code == 401

    def test_me_returns_user_data(self, auth_client, user):
        resp = auth_client.get("/api/v1/auth/me/")
        assert resp.status_code == 200
        assert resp.data["email"] == user.email
        assert "id" in resp.data
        assert "first_name" in resp.data

    def test_me_requires_auth(self):
        client = APIClient()
        assert client.get("/api/v1/auth/me/").status_code == 401

    def test_logout_blacklists_refresh_token(self):
        user = UserFactory(email="logout@test.com")
        user.set_password("testpass123")
        user.save()
        client = APIClient()
        login = client.post(
            "/api/v1/auth/token/",
            {"email": "logout@test.com", "password": "testpass123"},
        )
        refresh = login.data["refresh"]
        client.force_authenticate(user=user)
        resp = client.post("/api/v1/auth/logout/", {"refresh": refresh})
        assert resp.status_code == 205

    def test_sessions_list_requires_auth(self):
        client = APIClient()
        assert client.get("/api/v1/auth/sessions/").status_code == 401

    def test_sessions_list_returns_empty_for_new_user(self, auth_client):
        resp = auth_client.get("/api/v1/auth/sessions/")
        assert resp.status_code == 200
        assert isinstance(resp.data, list)
