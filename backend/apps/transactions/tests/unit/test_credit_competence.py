import datetime
from decimal import Decimal

import pytest

from apps.common.dtos import CreateTransactionDTO
from apps.common.factories import (
    CardFactory,
    CategoryFactory,
    PaymentMethodFactory,
    UserFactory,
)
from apps.core.models import CardFunction
from apps.transactions.services import TransactionService

pytestmark = pytest.mark.django_db


def _setup(card_function):
    user = UserFactory()
    card = CardFactory(user=user, closing_day=3, due_day=10)
    pm = PaymentMethodFactory(user=user, card=card, card_function=card_function)
    category = CategoryFactory(user=user)
    return user, pm, category


def _dto(user, pm, category, date):
    return CreateTransactionDTO(
        user_id=user.id,
        type="expense",
        kind="variable",
        description="Compra teste",
        amount=Decimal("100.00"),
        date=date,
        category_id=category.id,
        payment_method_id=pm.id,
    )


def test_credit_purchase_after_closing_lands_next_month():
    user, pm, category = _setup(CardFunction.CREDIT)
    tx = TransactionService().create(
        _dto(user, pm, category, datetime.date(2026, 6, 5))
    )
    assert (tx.year, tx.month) == (2026, 7)
    assert tx.date == datetime.date(2026, 6, 5)


def test_credit_purchase_before_closing_stays_in_month():
    user, pm, category = _setup(CardFunction.CREDIT)
    tx = TransactionService().create(
        _dto(user, pm, category, datetime.date(2026, 6, 2))
    )
    assert (tx.year, tx.month) == (2026, 6)


def test_debit_purchase_uses_purchase_month():
    user, pm, category = _setup(CardFunction.DEBIT)
    tx = TransactionService().create(
        _dto(user, pm, category, datetime.date(2026, 6, 5))
    )
    assert (tx.year, tx.month) == (2026, 6)


def test_non_card_payment_method_uses_purchase_month():
    user = UserFactory()
    pm = PaymentMethodFactory(user=user)
    category = CategoryFactory(user=user)
    tx = TransactionService().create(
        _dto(user, pm, category, datetime.date(2026, 6, 5))
    )
    assert (tx.year, tx.month) == (2026, 6)
