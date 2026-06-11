import datetime
from decimal import Decimal

import pytest

from apps.common.dtos import CreateTransactionDTO
from apps.common.exceptions import (
    DomainError,
    NotFoundError,
    ValidationDomainError,
)
from apps.common.factories import (
    CardInvoiceFactory,
    CategoryFactory,
    InvestmentFactory,
    InvestmentGoalFactory,
    PaymentMethodFactory,
    TransactionFactory,
    UserFactory,
)
from apps.transactions.models import TransactionKind, TransactionType
from apps.transactions.services import MonthSummaryService, TransactionService

pytestmark = pytest.mark.django_db


def test_income_forces_is_paid_true_and_null_category():
    user = UserFactory()
    category = CategoryFactory(user=user)
    service = TransactionService()
    dto = CreateTransactionDTO(
        user_id=user.id,
        type=TransactionType.INCOME,
        kind=TransactionKind.VARIABLE,
        description="Salário",
        amount=Decimal("5000.00"),
        date=datetime.date(2025, 1, 5),
        category_id=category.id,
        is_paid=False,
    )

    tx = service.create(dto)

    assert tx.is_paid is True
    assert tx.category_id is None


def test_expense_requires_category():
    user = UserFactory()
    service = TransactionService()
    dto = CreateTransactionDTO(
        user_id=user.id,
        type=TransactionType.EXPENSE,
        kind=TransactionKind.VARIABLE,
        description="Mercado",
        amount=Decimal("150.00"),
        date=datetime.date(2025, 1, 10),
        category_id=None,
    )

    with pytest.raises(ValidationDomainError) as exc:
        service.create(dto)

    assert "category" in exc.value.errors


def test_summary_matches_seed_january_exactly():
    user = UserFactory()
    food = CategoryFactory(user=user, name="Alimentação")
    pix = PaymentMethodFactory(user=user, name="Pix")

    # Income 5000 (Jan/2025)
    TransactionFactory(
        user=user,
        type=TransactionType.INCOME,
        kind=TransactionKind.VARIABLE,
        category=None,
        amount=Decimal("5000.00"),
        date=datetime.date(2025, 1, 5),
        is_paid=True,
    )
    # Fixed expense 1200
    TransactionFactory(
        user=user,
        type=TransactionType.EXPENSE,
        kind=TransactionKind.FIXED,
        category=food,
        payment_method=pix,
        amount=Decimal("1200.00"),
        date=datetime.date(2025, 1, 10),
        is_paid=True,
    )
    # Variable expense 800 (pending)
    TransactionFactory(
        user=user,
        type=TransactionType.EXPENSE,
        kind=TransactionKind.VARIABLE,
        category=food,
        payment_method=pix,
        amount=Decimal("800.00"),
        date=datetime.date(2025, 1, 15),
        is_paid=False,
    )
    # Investment 1000 + goal 1500
    InvestmentFactory(user=user, year=2025, month=1, amount=Decimal("1000.00"))
    InvestmentGoalFactory(
        user=user, year=2025, month=1, target_amount=Decimal("1500.00")
    )

    summary = MonthSummaryService().get_summary(user.id, 2025, 1)

    assert summary.total_income == Decimal("5000.00")
    assert summary.total_expense == Decimal("2000.00")
    assert summary.total_fixed == Decimal("1200.00")
    assert summary.total_variable == Decimal("800.00")
    assert summary.total_invested == Decimal("1000.00")
    # balance = income - expense - invested
    assert summary.balance == Decimal("2000.00")
    assert summary.pending_count == 1
    assert summary.investment_goal == Decimal("1500.00")
    assert summary.year == 2025
    assert summary.month == 1


def test_expense_with_zero_amount_is_rejected():
    user = UserFactory()
    cat = CategoryFactory(user=user)
    service = TransactionService()
    dto = CreateTransactionDTO(
        user_id=user.id,
        type=TransactionType.EXPENSE,
        kind=TransactionKind.VARIABLE,
        description="Zero",
        amount=Decimal("0.00"),
        date=datetime.date(2025, 1, 10),
        category_id=cat.id,
    )

    with pytest.raises(ValidationDomainError) as exc:
        service.create(dto)

    assert "amount" in exc.value.errors


def test_toggle_paid_flips_expense_flag():
    user = UserFactory()
    cat = CategoryFactory(user=user)
    service = TransactionService()
    dto = CreateTransactionDTO(
        user_id=user.id,
        type=TransactionType.EXPENSE,
        kind=TransactionKind.VARIABLE,
        description="Conta",
        amount=Decimal("100.00"),
        date=datetime.date(2025, 1, 10),
        category_id=cat.id,
        is_paid=False,
    )
    tx = service.create(dto)

    toggled = service.toggle_paid(tx.id, user.id)
    assert toggled.is_paid is True
    toggled = service.toggle_paid(tx.id, user.id)
    assert toggled.is_paid is False


def test_toggle_paid_on_income_raises_domain_error():
    user = UserFactory()
    service = TransactionService()
    dto = CreateTransactionDTO(
        user_id=user.id,
        type=TransactionType.INCOME,
        kind=TransactionKind.VARIABLE,
        description="Salário",
        amount=Decimal("5000.00"),
        date=datetime.date(2025, 1, 5),
    )
    tx = service.create(dto)

    with pytest.raises(DomainError):
        service.toggle_paid(tx.id, user.id)


def test_delete_transaction_removes_it():
    user = UserFactory()
    cat = CategoryFactory(user=user)
    service = TransactionService()
    dto = CreateTransactionDTO(
        user_id=user.id,
        type=TransactionType.EXPENSE,
        kind=TransactionKind.VARIABLE,
        description="Apagar",
        amount=Decimal("10.00"),
        date=datetime.date(2025, 1, 10),
        category_id=cat.id,
    )
    tx = service.create(dto)

    service.delete(tx.id, user.id)

    with pytest.raises(NotFoundError):
        service.toggle_paid(tx.id, user.id)


def test_summary_by_category_and_payment_method_populated():
    user = UserFactory()
    food = CategoryFactory(user=user, name="Alimentação")
    pix = PaymentMethodFactory(user=user, name="Pix")
    TransactionFactory(
        user=user,
        type=TransactionType.EXPENSE,
        kind=TransactionKind.VARIABLE,
        category=food,
        payment_method=pix,
        amount=Decimal("250.00"),
        date=datetime.date(2025, 2, 3),
        is_paid=True,
    )

    summary = MonthSummaryService().get_summary(user.id, 2025, 2)

    assert len(summary.by_category) == 1
    assert summary.by_category[0]["total"] == Decimal("250.00")
    assert len(summary.by_payment_method) == 1


def test_card_invoice_never_counts_as_expense():
    user = UserFactory()
    food = CategoryFactory(user=user, name="Alimentação")
    # A regular expense of 300
    TransactionFactory(
        user=user,
        type=TransactionType.EXPENSE,
        kind=TransactionKind.VARIABLE,
        category=food,
        amount=Decimal("300.00"),
        date=datetime.date(2025, 1, 12),
        is_paid=True,
    )
    # A CardInvoice for the same month — must NOT enter the expense total.
    CardInvoiceFactory(year=2025, month=1, amount=Decimal("999.00"))

    summary = MonthSummaryService().get_summary(user.id, 2025, 1)

    assert summary.total_expense == Decimal("300.00")
