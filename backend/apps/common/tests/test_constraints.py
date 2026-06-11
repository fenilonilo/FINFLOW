import datetime
from decimal import Decimal

import pytest
from django.db import IntegrityError

from apps.common.factories import (
    CardFactory,
    CardInvoiceFactory,
    CategoryFactory,
    InvestmentGoalFactory,
    PaymentMethodFactory,
    RecurringExpenseFactory,
    TransactionFactory,
    UserFactory,
)
from apps.transactions.models import Transaction, TransactionKind, TransactionType


@pytest.mark.django_db
class TestCategoryConstraints:
    def test_unique_category_name_per_user(self):
        user = UserFactory()
        CategoryFactory(user=user, name="Saúde")
        with pytest.raises(IntegrityError):
            CategoryFactory(user=user, name="Saúde")

    def test_same_name_different_users_ok(self):
        CategoryFactory(name="Saúde")
        CategoryFactory(name="Saúde")  # different user via factory

    def test_parent_subcategory_link(self):
        user = UserFactory()
        parent = CategoryFactory(user=user, name="Alimentação")
        child = CategoryFactory(user=user, name="Restaurante", parent=parent)
        assert child.parent_id == parent.id


@pytest.mark.django_db
class TestPaymentMethodConstraints:
    def test_unique_payment_method_name_per_user(self):
        user = UserFactory()
        PaymentMethodFactory(user=user, name="Pix")
        with pytest.raises(IntegrityError):
            PaymentMethodFactory(user=user, name="Pix")

    def test_same_name_different_users_ok(self):
        PaymentMethodFactory(name="Pix")
        PaymentMethodFactory(name="Pix")  # different user via factory


@pytest.mark.django_db
class TestTransactionConstraints:
    def test_year_month_derived_on_save(self):
        t = TransactionFactory(date=datetime.date(2025, 3, 15))
        assert t.year == 2025
        assert t.month == 3

    def test_unique_recurring_per_month(self):
        recurring = RecurringExpenseFactory()
        TransactionFactory(
            user=recurring.user,
            recurring_source=recurring,
            date=datetime.date(2025, 1, 10),
        )
        with pytest.raises(IntegrityError):
            t = Transaction(
                user=recurring.user,
                recurring_source=recurring,
                type=TransactionType.EXPENSE,
                kind=TransactionKind.FIXED,
                description="dup",
                amount=Decimal("100.00"),
                date=datetime.date(2025, 1, 20),
                year=2025,
                month=1,
                is_paid=False,
            )
            t.save()


@pytest.mark.django_db
class TestInvestmentGoalConstraints:
    def test_unique_goal_per_user_month(self):
        user = UserFactory()
        InvestmentGoalFactory(user=user, year=2025, month=1)
        with pytest.raises(IntegrityError):
            InvestmentGoalFactory(user=user, year=2025, month=1)


@pytest.mark.django_db
class TestCardInvoiceConstraints:
    def test_unique_invoice_per_card_month(self):
        card = CardFactory()
        CardInvoiceFactory(card=card, year=2025, month=1)
        with pytest.raises(IntegrityError):
            CardInvoiceFactory(card=card, year=2025, month=1)
