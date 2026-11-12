import json
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.common.factories import (
    CardFactory,
    CategoryFactory,
    StatementImportFactory,
    UserFactory,
)
from apps.transactions import services
from apps.transactions.models import StatementImport, Transaction

pytestmark = pytest.mark.django_db

CSV = b'date,title,amount\n2026-11-04,Loja Xpto,"10,00"\n'


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setattr(services, "classify", lambda d, c: [None] * len(d))
    user = UserFactory()
    api = APIClient()
    api.force_authenticate(user=user)
    return api, user, CardFactory(user=user)


def _post(api, card, **extra):
    return api.post(
        "/api/v1/imports/statement/",
        {
            "file": SimpleUploadedFile("Nubank_2026-11-12.csv", CSV),
            "card_id": card.id,
            "kind": "credit",
            "year": 2026,
            "month": 11,
            **extra,
        },
        format="multipart",
    )


def test_dry_run_returns_200_and_saves_nothing(env):
    api, user, card = env
    resp = _post(api, card, dry_run="true")
    assert resp.status_code == 200
    assert resp.data["created"] == 1
    assert Transaction.objects.filter(user=user).count() == 0


def test_real_import_returns_201_with_chosen_category(env):
    api, user, card = env
    cat = CategoryFactory(user=user)
    resp = _post(api, card, categories=json.dumps({"0": cat.id}))
    assert resp.status_code == 201
    assert Transaction.objects.get(user=user).category_id == cat.id


def test_foreign_category_returns_400_on_categories(env):
    api, _, card = env
    foreign = CategoryFactory(user=UserFactory())
    resp = _post(api, card, categories=json.dumps({"0": foreign.id}))
    assert resp.status_code == 400
    assert "categories" in resp.data["errors"]


def test_malformed_categories_returns_400(env):
    api, _, card = env
    resp = _post(api, card, categories="{nope")
    assert resp.status_code == 400
    assert "categories" in resp.data


def test_non_integer_category_value_returns_400(env):
    api, _, card = env
    for bad in ('{"0": 1.5}', '{"0": true}', '{"0": "x"}'):
        resp = _post(api, card, categories=bad)
        assert resp.status_code == 400
        assert "categories" in resp.data


def test_real_import_records_history_and_dry_run_does_not(env):
    api, user, card = env
    _post(api, card, dry_run="true")
    assert StatementImport.objects.count() == 0
    _post(api, card)
    h = StatementImport.objects.get(user=user)
    assert (h.card_id, h.kind, h.year, h.month) == (card.id, "credit", 2026, 11)
    assert h.filename == "Nubank_2026-11-12.csv"
    assert (h.created_count, h.skipped_count, h.total) == (1, 0, Decimal("10.00"))


def test_list_imports_only_own_max_12_newest_first(env):
    api, user, card = env
    for i in range(13):
        StatementImportFactory(user=user, card=card, filename=f"f{i}.csv")
    StatementImportFactory()
    resp = api.get("/api/v1/imports/")
    assert resp.status_code == 200
    assert len(resp.data) == 12
    assert resp.data[0]["filename"] == "f12.csv"
    assert set(resp.data[0]) == {
        "id", "card_id", "card_name", "card_bank", "kind", "year", "month",
        "filename", "created_count", "skipped_count", "total", "created_at",
    }  # fmt: skip
    assert resp.data[0]["card_name"] == card.name
    assert resp.data[0]["total"] == "10.00"
