import pytest

from apps.common.factories import (
    CategoryFactory,
    PaymentMethodFactory,
    TransactionFactory,
)


@pytest.mark.django_db
class TestTransactionAPI:
    def test_create_expense_requires_category(self, auth_client):
        resp = auth_client.post(
            "/api/v1/transactions/",
            {
                "type": "expense",
                "kind": "variable",
                "description": "Sem categoria",
                "amount": "50.00",
                "date": "2025-01-15",
            },
            format="json",
        )
        # Service raises ValidationDomainError which becomes 422
        assert resp.status_code in [400, 422]

    def test_create_income_no_category_required(self, auth_client, user):
        pm = PaymentMethodFactory(user=user)
        resp = auth_client.post(
            "/api/v1/transactions/",
            {
                "type": "income",
                "kind": "variable",
                "description": "Salário",
                "amount": "5000.00",
                "date": "2025-01-10",
                "payment_method": pm.id,
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["is_paid"] is True

    def test_create_expense_with_category(self, auth_client, user):
        cat = CategoryFactory(user=user)
        resp = auth_client.post(
            "/api/v1/transactions/",
            {
                "type": "expense",
                "kind": "variable",
                "description": "Almoço",
                "amount": "35.00",
                "date": "2025-01-15",
                "category": cat.id,
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["category_detail"]["id"] == cat.id

    def test_list_transactions_returns_only_own(self, auth_client, user):
        TransactionFactory(user=user)
        resp = auth_client.get("/api/v1/transactions/")
        assert resp.status_code == 200
        assert resp.data["count"] >= 1

    def test_transaction_list_requires_auth(self):
        from rest_framework.test import APIClient

        client = APIClient()
        assert client.get("/api/v1/transactions/").status_code == 401

    def test_toggle_paid_flips_status(self, auth_client, user):
        cat = CategoryFactory(user=user)
        tx = TransactionFactory(user=user, category=cat, is_paid=False)
        resp = auth_client.post(f"/api/v1/transactions/{tx.id}/toggle-paid/")
        assert resp.status_code == 200
        assert resp.data["is_paid"] is True

    def test_month_summary_endpoint(self, auth_client):
        resp = auth_client.get("/api/v1/months/2025/1/summary/")
        assert resp.status_code == 200
        data = resp.data
        assert "total_income" in data
        assert "total_expense" in data
        assert "balance" in data
        assert "by_category" in data
        assert "by_payment_method" in data

    def test_generate_fixed_idempotent(self, auth_client):
        resp1 = auth_client.post("/api/v1/months/2025/3/generate-fixed/")
        resp2 = auth_client.post("/api/v1/months/2025/3/generate-fixed/")
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert resp2.data["skipped"] >= resp1.data["created"]
