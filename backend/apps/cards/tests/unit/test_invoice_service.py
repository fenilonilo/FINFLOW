import datetime
from decimal import Decimal

import pytest

from apps.cards.services import CardInvoiceService
from apps.common.dtos import CreateTransactionDTO
from apps.common.factories import (
    CardFactory,
    CategoryFactory,
    PaymentMethodFactory,
    UserFactory,
)
from apps.core.models import CardFunction
from apps.transactions.models import Debt, Transaction
from apps.transactions.services import TransactionService

pytestmark = pytest.mark.django_db


@pytest.fixture
def env():
    user = UserFactory()
    card = CardFactory(
        user=user, closing_day=3, due_day=10, limit=Decimal("5000.00")
    )
    pm = PaymentMethodFactory(user=user, card=card, card_function=CardFunction.CREDIT)
    category = CategoryFactory(user=user)
    return user, card, pm, category


def _buy(user, pm, category, amount, date):
    return TransactionService().create(
        CreateTransactionDTO(
            user_id=user.id,
            type="expense",
            kind="variable",
            description="Compra",
            amount=Decimal(amount),
            date=date,
            category_id=category.id,
            payment_method_id=pm.id,
        )
    )


def test_summary_computes_invoice_and_committed(env):
    user, card, pm, category = env
    _buy(user, pm, category, "100.00", datetime.date(2026, 6, 2))  # fatura jun
    _buy(user, pm, category, "50.00", datetime.date(2026, 6, 10))  # fatura jul
    [summary] = CardInvoiceService().summary(user.id, 2026, 6)
    assert summary.invoice.amount == Decimal("100.00")
    assert summary.committed == Decimal("150.00")
    assert summary.committed_pct == Decimal("3.00")
    assert summary.invoice.cycle_start == datetime.date(2026, 5, 4)
    assert summary.invoice.cycle_end == datetime.date(2026, 6, 3)
    assert summary.invoice.due_date == datetime.date(2026, 6, 10)
    assert summary.invoice.is_paid is False


def test_pay_invoice_snapshots_and_marks_transactions(env):
    user, card, pm, category = env
    tx = _buy(user, pm, category, "100.00", datetime.date(2026, 6, 2))
    invoice = CardInvoiceService().set_invoice_paid(
        user.id, card.id, 2026, 6, is_paid=True
    )
    assert invoice.is_paid is True
    assert invoice.snapshot_amount == Decimal("100.00")
    tx.refresh_from_db()
    assert tx.is_paid is True
    # fatura paga sai do comprometido
    [summary] = CardInvoiceService().summary(user.id, 2026, 6)
    assert summary.committed == Decimal("0")


def test_pay_invoice_advances_card_debt(env):
    user, card, pm, category = env
    TransactionService().create_installment_purchase(
        CreateTransactionDTO(
            user_id=user.id,
            type="expense",
            kind="variable",
            description="Notebook",
            amount=Decimal("300.00"),
            date=datetime.date(2026, 6, 5),  # 1ª parcela julho
            category_id=category.id,
            payment_method_id=pm.id,
        ),
        installments=3,
    )
    CardInvoiceService().set_invoice_paid(user.id, card.id, 2026, 7, is_paid=True)
    debt = Debt.objects.get(user=user)
    assert debt.installment_current == 1
    assert debt.is_settled is False


def test_unpay_invoice_reverts_debt_and_transactions(env):
    user, card, pm, category = env
    TransactionService().create_installment_purchase(
        CreateTransactionDTO(
            user_id=user.id,
            type="expense",
            kind="variable",
            description="Notebook",
            amount=Decimal("300.00"),
            date=datetime.date(2026, 6, 5),
            category_id=category.id,
            payment_method_id=pm.id,
        ),
        installments=3,
    )
    service = CardInvoiceService()
    service.set_invoice_paid(user.id, card.id, 2026, 7, is_paid=True)
    service.set_invoice_paid(user.id, card.id, 2026, 7, is_paid=False)
    debt = Debt.objects.get(user=user)
    assert debt.installment_current == 0
    assert (
        Transaction.objects.filter(debt=debt, is_paid=True).count() == 0
    )


def test_divergent_when_retroactive_purchase_after_payment(env):
    user, card, pm, category = env
    _buy(user, pm, category, "100.00", datetime.date(2026, 6, 2))
    CardInvoiceService().set_invoice_paid(user.id, card.id, 2026, 6, is_paid=True)
    _buy(user, pm, category, "40.00", datetime.date(2026, 6, 1))  # retroativa
    [summary] = CardInvoiceService().summary(user.id, 2026, 6)
    assert summary.invoice.snapshot_amount == Decimal("100.00")
    assert summary.invoice.amount == Decimal("140.00")
    assert summary.invoice.divergent is True
