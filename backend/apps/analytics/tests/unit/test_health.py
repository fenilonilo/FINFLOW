import datetime
from decimal import Decimal

import pytest

from apps.analytics.services import FinancialHealthService
from apps.common.factories import (
    CategoryFactory,
    InvestmentFactory,
    TransactionFactory,
    UserFactory,
)
from apps.transactions.models import TransactionKind, TransactionType

pytestmark = pytest.mark.django_db


def _add_month(user, year, month, income, expense, invested):
    if income:
        TransactionFactory(
            user=user,
            type=TransactionType.INCOME,
            kind=TransactionKind.VARIABLE,
            category=None,
            amount=Decimal(income),
            date=datetime.date(year, month, 5),
            is_paid=True,
        )
    if expense:
        cat = CategoryFactory(user=user)
        TransactionFactory(
            user=user,
            type=TransactionType.EXPENSE,
            kind=TransactionKind.FIXED,
            category=cat,
            amount=Decimal(expense),
            date=datetime.date(year, month, 10),
            is_paid=True,
        )
    if invested:
        InvestmentFactory(user=user, year=year, month=month, amount=Decimal(invested))


def test_baseline_no_movement_returns_zero_score():
    user = UserFactory()
    service = FinancialHealthService()

    health = service.baseline(user.id, 2025, 6)

    assert health.score == 0
    assert health.score_label == "Crítico"
    assert health.avg_monthly_income == Decimal("0")


def test_baseline_averages_over_months_with_movement():
    user = UserFactory()
    # Two months prior to reference (June): May and April.
    _add_month(user, 2025, 5, "6000", "3000", "1000")
    _add_month(user, 2025, 4, "6000", "3000", "1000")
    service = FinancialHealthService()

    health = service.baseline(user.id, 2025, 6)

    assert health.avg_monthly_income == Decimal("6000.00")
    assert health.avg_monthly_expense == Decimal("3000.00")
    assert health.avg_monthly_invested == Decimal("1000.00")
    # balance = 6000 - 3000 - 1000 = 2000
    assert health.avg_balance == Decimal("2000.00")
    # savings rate = 1000/6000 = 16.67%
    assert health.savings_rate_pct == Decimal("16.67")
    # fixed commitment = 3000/6000 = 50%
    assert health.fixed_commitment_pct == Decimal("50.00")
    assert 0 < health.score <= 100
    assert health.score_label in {"Excelente", "Saudável", "Atenção", "Crítico"}


def test_baseline_reference_month_itself_is_excluded():
    user = UserFactory()
    # Movement in reference month (June) only — looks back, so no prior data.
    _add_month(user, 2025, 6, "9000", "1000", "5000")
    service = FinancialHealthService()

    health = service.baseline(user.id, 2025, 6)

    assert health.avg_monthly_income == Decimal("0")
    assert health.score == 0
