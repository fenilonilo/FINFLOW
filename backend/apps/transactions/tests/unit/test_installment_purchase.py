import datetime
from decimal import Decimal

import pytest

from apps.common.dtos import CreateTransactionDTO
from apps.common.exceptions import ValidationDomainError
from apps.common.factories import (
    CardFactory,
    CategoryFactory,
    PaymentMethodFactory,
    UserFactory,
)
from apps.core.models import CardFunction
from apps.transactions.models import Debt, DebtOrigin
from apps.transactions.services import TransactionService

pytestmark = pytest.mark.django_db


def _setup(card_function=CardFunction.CREDIT):
    user = UserFactory()
    card = CardFactory(user=user, closing_day=3, due_day=10)
    pm = PaymentMethodFactory(user=user, card=card, card_function=card_function)
    category = CategoryFactory(user=user)
    return user, pm, category


def _dto(user, pm, category, amount="1200.00", date=datetime.date(2026, 6, 5)):
    return CreateTransactionDTO(
        user_id=user.id,
        type="expense",
        kind="variable",
        description="Notebook",
        amount=Decimal(amount),
        date=date,
        category_id=category.id,
        payment_method_id=pm.id,
    )


def test_creates_debt_and_installments():
    user, pm, category = _setup()
    txs = TransactionService().create_installment_purchase(
        _dto(user, pm, category), installments=6
    )
    debt = Debt.objects.get(user=user)
    assert debt.origin == DebtOrigin.CARD_PURCHASE
    assert debt.creditor == "Notebook"
    assert debt.total_amount == Decimal("1200.00")
    assert debt.installment_total == 6
    assert debt.installment_current == 0
    assert len(txs) == 6
    # compra 05/06 fecha dia 3 → 1ª parcela competência julho
    assert (txs[0].year, txs[0].month) == (2026, 7)
    assert (txs[5].year, txs[5].month) == (2026, 12)
    assert all(tx.debt_id == debt.id for tx in txs)
    assert all(tx.amount == Decimal("200.00") for tx in txs)
    assert [tx.installment_current for tx in txs] == [1, 2, 3, 4, 5, 6]


def test_cent_adjustment_on_last_installment():
    user, pm, category = _setup()
    txs = TransactionService().create_installment_purchase(
        _dto(user, pm, category, amount="100.00"), installments=3
    )
    amounts = [tx.amount for tx in txs]
    assert amounts == [Decimal("33.33"), Decimal("33.33"), Decimal("33.34")]
    assert sum(amounts) == Decimal("100.00")


def test_year_rollover_competences():
    user, pm, category = _setup()
    txs = TransactionService().create_installment_purchase(
        _dto(user, pm, category, date=datetime.date(2026, 11, 20)), installments=3
    )
    assert [(t.year, t.month) for t in txs] == [(2026, 12), (2027, 1), (2027, 2)]


def test_rejects_non_credit_payment_method():
    user, pm, category = _setup(card_function=CardFunction.DEBIT)
    with pytest.raises(ValidationDomainError):
        TransactionService().create_installment_purchase(
            _dto(user, pm, category), installments=3
        )


def test_rejects_single_installment():
    user, pm, category = _setup()
    with pytest.raises(ValidationDomainError):
        TransactionService().create_installment_purchase(
            _dto(user, pm, category), installments=1
        )
