"""Prova de desacoplamento (plano sec. 3.2 / 9 checklist):
injetar um FakeAIAdvisor NAO exige alterar nenhum service.
"""
import datetime
from decimal import Decimal

import pytest

from apps.analytics.services import FinancialHealthService
from apps.common.adapters import NullAIAdvisor
from apps.common.factories import (
    CategoryFactory,
    InvestmentFactory,
    TransactionFactory,
    UserFactory,
)
from apps.common.ports import AdviceDTO
from apps.transactions.models import TransactionKind, TransactionType

pytestmark = pytest.mark.django_db


class FakeAIAdvisor:
    """Test double implementing AIAdvisorPort. Records calls."""

    def __init__(self) -> None:
        self.calls: list = []

    def analyze_spending(self, summary: object) -> AdviceDTO:
        self.calls.append(summary)
        return AdviceDTO(message="conselho de teste")

    def plan_budget(self, goal: object) -> object:  # pragma: no cover
        return None


def test_default_advisor_is_null_adviser():
    service = FinancialHealthService()
    assert isinstance(service._advisor, NullAIAdvisor)


def test_inject_fake_ai_advisor_without_changing_service():
    user = UserFactory()
    cat = CategoryFactory(user=user)
    TransactionFactory(
        user=user,
        type=TransactionType.INCOME,
        kind=TransactionKind.VARIABLE,
        category=None,
        amount=Decimal("6000"),
        date=datetime.date(2025, 5, 5),
        is_paid=True,
    )
    TransactionFactory(
        user=user,
        type=TransactionType.EXPENSE,
        kind=TransactionKind.FIXED,
        category=cat,
        amount=Decimal("3000"),
        date=datetime.date(2025, 5, 10),
        is_paid=True,
    )
    InvestmentFactory(user=user, year=2025, month=5, amount=Decimal("1000"))

    fake = FakeAIAdvisor()
    # Same constructor as production — only the port implementation differs.
    service = FinancialHealthService(advisor=fake)

    advice = service.advise(user.id, 2025, 6)

    assert advice.message == "conselho de teste"
    assert len(fake.calls) == 1
