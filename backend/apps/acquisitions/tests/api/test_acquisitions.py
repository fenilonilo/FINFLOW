import pytest
from rest_framework.test import APIClient

from apps.common.factories import CategoryFactory


@pytest.mark.django_db
class TestAcquisitionSimulate:
    def test_simulate_financing_price(self, auth_client):
        resp = auth_client.post(
            "/api/v1/acquisitions/simulate/",
            {
                "name": "Notebook Dell",
                "total_value": "10000.00",
                "acquisition_type": "financing",
                "down_payment": "2000.00",
                "installments_count": 24,
                "monthly_interest_rate": "1.9900",
                "amortization_system": "price",
                "extra_monthly_cost": "0.00",
                "start_date": "2026-07-01",
            },
            format="json",
        )
        assert resp.status_code == 200
        assert "schedule" in resp.data
        assert len(resp.data["schedule"]) == 24
        assert resp.data["impact"]["verdict"] in [
            "safe", "moderate", "risky", "critical"
        ]
        # Validate shape of first installment
        first = resp.data["schedule"][0]
        assert "number" in first
        assert "due_date" in first
        assert "amount" in first
        assert "interest_portion" in first
        assert "principal_portion" in first
        assert "remaining_balance" in first

    def test_simulate_cash(self, auth_client):
        resp = auth_client.post(
            "/api/v1/acquisitions/simulate/",
            {
                "name": "Celular",
                "total_value": "2000.00",
                "acquisition_type": "cash",
                "start_date": "2026-01-01",
            },
            format="json",
        )
        assert resp.status_code == 200
        assert len(resp.data["schedule"]) == 1

    def test_simulate_requires_auth(self):
        client = APIClient()
        resp = client.post(
            "/api/v1/acquisitions/simulate/",
            {
                "name": "X",
                "total_value": "1000.00",
                "acquisition_type": "cash",
                "start_date": "2026-01-01",
            },
            format="json",
        )
        assert resp.status_code == 401


@pytest.mark.django_db
class TestAcquisitionActivate:
    def test_activate_creates_recurring_with_total_occurrences(self, auth_client, user):
        cat = CategoryFactory(user=user)
        create_resp = auth_client.post(
            "/api/v1/acquisitions/",
            {
                "name": "Carro",
                "total_value": "30000.00",
                "acquisition_type": "installment",
                "down_payment": "5000.00",
                "installments_count": 12,
                "amortization_system": "none",
                "extra_monthly_cost": "0.00",
                "start_date": "2026-01-01",
                "category": cat.id,
            },
            format="json",
        )
        assert create_resp.status_code == 201
        acq_id = create_resp.data["id"]

        activate_resp = auth_client.post(f"/api/v1/acquisitions/{acq_id}/activate/")
        assert activate_resp.status_code == 200
        assert activate_resp.data["status"] == "active"
        assert activate_resp.data["recurring_expense"] is not None

        from apps.transactions.models import RecurringExpense

        recurring = RecurringExpense.objects.get(
            id=activate_resp.data["recurring_expense"]
        )
        assert recurring.total_occurrences == 12

    def test_activate_already_active_returns_400(self, auth_client, user):
        cat = CategoryFactory(user=user)
        create_resp = auth_client.post(
            "/api/v1/acquisitions/",
            {
                "name": "Casa",
                "total_value": "200000.00",
                "acquisition_type": "financing",
                "down_payment": "40000.00",
                "installments_count": 36,
                "monthly_interest_rate": "0.9900",
                "amortization_system": "price",
                "extra_monthly_cost": "0.00",
                "start_date": "2026-01-01",
                "category": cat.id,
            },
            format="json",
        )
        acq_id = create_resp.data["id"]
        auth_client.post(f"/api/v1/acquisitions/{acq_id}/activate/")
        # Second activation should fail
        resp = auth_client.post(f"/api/v1/acquisitions/{acq_id}/activate/")
        assert resp.status_code == 400
