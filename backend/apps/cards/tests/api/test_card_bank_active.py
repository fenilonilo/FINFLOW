import pytest
from rest_framework.test import APIClient

from apps.common.exceptions import ValidationDomainError
from apps.common.factories import UserFactory
from apps.transactions.services import StatementImportService

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    user = UserFactory()
    api = APIClient()
    api.force_authenticate(user=user)
    return api, user


def _mk(api, **extra):
    return api.post(
        "/api/v1/cards/",
        {
            "name": "Nubank",
            "closing_day": 3,
            "due_day": 10,
            "functions": ["credit"],
            **extra,
        },
        format="json",
    )


def test_bank_and_is_active_patch_alone(client):
    api, _ = client
    resp = _mk(api, bank="nubank")
    assert resp.data["bank"] == "nubank" and resp.data["is_active"] is True
    patched = api.patch(
        f"/api/v1/cards/{resp.data['id']}/", {"is_active": False}, format="json"
    )
    assert patched.status_code == 200
    assert patched.data["is_active"] is False and patched.data["bank"] == "nubank"
    assert patched.data["active_functions"] == ["credit"]


def test_active_filter_summary_order_and_pm_hidden(client):
    api, _ = client
    off = _mk(api, name="Off").data["id"]
    on = _mk(api, name="On").data["id"]
    api.patch(f"/api/v1/cards/{off}/", {"is_active": False}, format="json")
    ids = [c["id"] for c in api.get("/api/v1/cards/?active=true").data["results"]]
    assert ids == [on]
    summ = api.get("/api/v1/cards/summary/?year=2026&month=11").data
    assert [s["card_id"] for s in summ] == [on, off]
    assert summ[1]["is_active"] is False and summ[0]["bank"] == "other"
    pm_cards = {p["card"] for p in api.get("/api/v1/payment-methods/").data["results"]}
    assert off not in pm_cards and on in pm_cards


def test_import_inactive_card_rejected(client):
    api, user = client
    cid = _mk(api, is_active=False).data["id"]
    with pytest.raises(ValidationDomainError) as e:
        StatementImportService().import_file(user.id, b"x", "a.csv", cid, "debit")
    assert "Cartão inativo." in repr(vars(e.value))
