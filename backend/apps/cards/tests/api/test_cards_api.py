import datetime
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.common.dtos import CreateTransactionDTO
from apps.common.factories import CategoryFactory, UserFactory
from apps.core.models import PaymentMethod
from apps.transactions.services import TransactionService

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    user = UserFactory()
    api = APIClient()
    api.force_authenticate(user=user)
    return api, user


def test_create_card_with_functions_and_limit(client):
    api, user = client
    resp = api.post(
        "/api/v1/cards/",
        {
            "name": "Nubank",
            "color": "#820ad1",
            "closing_day": 3,
            "due_day": 10,
            "limit": "5000.00",
            "functions": ["credit", "debit"],
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["limit"] == "5000.00"
    assert sorted(resp.data["active_functions"]) == ["credit", "debit"]
    assert PaymentMethod.objects.filter(user=user, card__isnull=False).count() == 2


def test_create_card_without_functions_returns_validation_envelope(client):
    api, _ = client
    resp = api.post(
        "/api/v1/cards/",
        {
            "name": "X",
            "color": "#fff",
            "closing_day": 3,
            "due_day": 10,
            "functions": [],
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "functions" in resp.data["errors"]


def test_summary_and_pay_invoice_flow(client):
    api, user = client
    resp = api.post(
        "/api/v1/cards/",
        {
            "name": "Nubank",
            "color": "#820ad1",
            "closing_day": 3,
            "due_day": 10,
            "limit": "1000.00",
            "functions": ["credit"],
        },
        format="json",
    )
    card_id = resp.data["id"]
    pm = PaymentMethod.objects.get(card_id=card_id, card_function="credit")
    category = CategoryFactory(user=user)
    TransactionService().create(
        CreateTransactionDTO(
            user_id=user.id,
            type="expense",
            kind="variable",
            description="Compra",
            amount=Decimal("250.00"),
            date=datetime.date(2026, 6, 2),
            category_id=category.id,
            payment_method_id=pm.id,
        )
    )

    resp = api.get("/api/v1/cards/summary/", {"year": 2026, "month": 6})
    assert resp.status_code == 200
    [card] = resp.data
    assert card["invoice"]["amount"] == "250.00"
    assert card["committed"] == "250.00"
    assert card["committed_pct"] == "25.00"
    assert card["invoice"]["is_paid"] is False

    resp = api.post(
        f"/api/v1/cards/{card_id}/pay-invoice/",
        {"year": 2026, "month": 6, "is_paid": True},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["is_paid"] is True
    assert resp.data["snapshot_amount"] == "250.00"
