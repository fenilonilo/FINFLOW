import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.common.factories import UserFactory

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32
URL = "/api/v1/auth/me/"
AVATAR = "/api/v1/auth/me/avatar/"


@pytest.fixture(autouse=True)
def media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def up(content, name="a.png"):
    return {"avatar": SimpleUploadedFile(name, content)}


def test_patch_first_name(auth_client):
    resp = auth_client.patch(URL, {"first_name": "Novo"})
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Novo"
    assert resp.json()["avatar_url"] is None


def test_patch_blank_first_name_400(auth_client):
    assert auth_client.patch(URL, {"first_name": ""}, format="json").status_code == 400


def test_patch_duplicate_email_400(auth_client):
    UserFactory(email="Dup@test.com")
    resp = auth_client.patch(URL, {"email": "dup@TEST.com"})
    assert resp.status_code == 400
    assert "email" in resp.json()["errors"]


def test_patch_own_email_ok(auth_client, user):
    assert auth_client.patch(URL, {"email": user.email.upper()}).status_code == 200


def test_upload_png(auth_client, tmp_path):
    resp = auth_client.post(AVATAR, up(PNG), format="multipart")
    assert resp.status_code == 200
    url = resp.json()["avatar_url"]
    assert url.startswith("/media/avatars/") and url.endswith(".png")
    assert len(list((tmp_path / "avatars").iterdir())) == 1


def test_replace_deletes_old_file(auth_client, tmp_path):
    auth_client.post(AVATAR, up(PNG), format="multipart")
    jpg = b"\xff\xd8\xff" + b"0" * 10
    resp = auth_client.post(AVATAR, up(jpg, "b.jpg"), format="multipart")
    assert resp.json()["avatar_url"].endswith(".jpg")
    assert len(list((tmp_path / "avatars").iterdir())) == 1


@pytest.mark.parametrize(
    "content", [b"GIF89a" + b"0" * 20, b"texto qualquer"], ids=["gif", "text"]
)
def test_upload_invalid_signature_400(auth_client, content):
    resp = auth_client.post(AVATAR, up(content), format="multipart")
    assert resp.status_code == 400
    assert "avatar" in resp.json()["errors"]


def test_upload_too_big_400(auth_client):
    resp = auth_client.post(
        AVATAR, up(PNG + b"0" * (2 * 1024 * 1024)), format="multipart"
    )
    assert resp.status_code == 400
    assert "avatar" in resp.json()["errors"]


def test_upload_missing_file_400(auth_client):
    resp = auth_client.post(AVATAR, {}, format="multipart")
    assert resp.status_code == 400
    assert "avatar" in resp.json()["errors"]


def test_delete_clears(auth_client, tmp_path):
    auth_client.post(AVATAR, up(PNG), format="multipart")
    assert auth_client.delete(AVATAR).status_code == 204
    assert auth_client.get(URL).json()["avatar_url"] is None
    assert list((tmp_path / "avatars").iterdir()) == []


def test_requires_auth():
    c = APIClient()
    assert c.patch(URL, {"first_name": "x"}).status_code == 401
    assert c.post(AVATAR).status_code == 401
    assert c.delete(AVATAR).status_code == 401
