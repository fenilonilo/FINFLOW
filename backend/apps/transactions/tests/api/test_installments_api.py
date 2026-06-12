import pytest
from rest_framework.test import APIClient

from apps.common.factories import (
    CardFactory,
    CategoryFactory,
    PaymentMethodFactory,
    UserFactory,
)
from apps.core.models import CardFunction
from apps.transactions.models import Debt, Transaction

pytestmark = pytest.mark.django_db


@pytest.fixture
def env():
    user = UserFactory()
    api = APIClient()
    api.force_authenticate(user=user)
    card = CardFactory(user=user, closing_day=3, due_day=10)
    pm = PaymentMethodFactory(user=user, card=card, card_function=CardFunction.CREDIT)
    category = CategoryFactory(user=user)
    return api, user, card, pm, category


def test_post_transaction_with_installments_creates_debt(env):
    api, user, card, pm, category = env
    resp = api.post(
        "/api/v1/transactions/",
        {
            "type": "expense",
            "kind": "variable",
            "description": "Notebook",
            "amount": "1200.00",
            "date": "2026-06-05",
            "category": category.id,
            "payment_method": pm.id,
            "installments": 6,
        },
        format="json",
    )
    assert resp.status_code == 201
    assert Debt.objects.filter(user=user).count() == 1
    assert Transaction.objects.filter(user=user).count() == 6
    assert resp.data["installment_current"] == 1
    assert resp.data["installment_total"] == 6


def test_installments_rejected_for_debit(env):
    api, user, card, pm, category = env
    debit_pm = PaymentMethodFactory(
        user=user, card=card, card_function=CardFunction.DEBIT
    )
    resp = api.post(
        "/api/v1/transactions/",
        {
            "type": "expense",
            "kind": "variable",
            "description": "X",
            "amount": "100.00",
            "date": "2026-06-05",
            "category": category.id,
            "payment_method": debit_pm.id,
            "installments": 3,
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "payment_method" in resp.data["errors"]


def test_patch_payment_method_recalculates_competence(env):
    api, user, card, pm, category = env
    resp = api.post(
        "/api/v1/transactions/",
        {
            "type": "expense",
            "kind": "variable",
            "description": "X",
            "amount": "100.00",
            "date": "2026-06-05",
            "category": category.id,
        },
        format="json",
    )
    tx_id = resp.data["id"]
    assert resp.data["month"] == 6
    resp = api.patch(
        f"/api/v1/transactions/{tx_id}/",
        {"payment_method": pm.id},
        format="json",
    )
    assert resp.data["month"] == 7  # crédito, compra 05/06 fecha dia 3


def test_payment_method_serializer_exposes_card_detail(env):
    api, user, card, pm, category = env
    resp = api.get("/api/v1/payment-methods/")
    item = next(p for p in resp.data["results"] if p["id"] == pm.id)
    assert item["card_function"] == "credit"
    assert item["card_detail"]["closing_day"] == 3
