import datetime
from decimal import Decimal

import factory
from factory.django import DjangoModelFactory

from apps.accounts.models import DeviceSession, User
from apps.acquisitions.models import (
    Acquisition,
    AcquisitionInstallment,
    AcquisitionStatus,
    AcquisitionType,
    AmortizationSystem,
)
from apps.cards.models import Card, CardInvoice
from apps.core.models import Category, PaymentMethod
from apps.investments.models import Investment, InvestmentGoal
from apps.transactions.models import (
    Debt,
    RecurringExpense,
    RecurringStatus,
    Transaction,
    TransactionKind,
    TransactionType,
)


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    email = factory.Sequence(lambda n: f"user{n}@finflow.test")
    first_name = factory.Faker("first_name")
    password = factory.django.Password("testpass123")


class DeviceSessionFactory(DjangoModelFactory):
    class Meta:
        model = DeviceSession

    user = factory.SubFactory(UserFactory)
    device_name = factory.Sequence(lambda n: f"Device {n}")
    revoked = False


class CategoryFactory(DjangoModelFactory):
    class Meta:
        model = Category

    user = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: f"Categoria {n}")
    icon = "circle"
    color = "#94a3b8"
    is_default = False
    is_archived = False


class PaymentMethodFactory(DjangoModelFactory):
    class Meta:
        model = PaymentMethod

    user = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: f"Forma {n}")
    icon = "credit-card"
    color = "#94a3b8"
    card = None
    card_function = None
    is_default = False
    is_archived = False


class RecurringExpenseFactory(DjangoModelFactory):
    class Meta:
        model = RecurringExpense

    user = factory.SubFactory(UserFactory)
    category = factory.SubFactory(CategoryFactory, user=factory.SelfAttribute("..user"))
    payment_method = factory.SubFactory(
        PaymentMethodFactory, user=factory.SelfAttribute("..user")
    )
    description = factory.Sequence(lambda n: f"Gasto Fixo {n}")
    is_variable = False
    default_amount = Decimal("100.00")
    due_day = 10
    status = RecurringStatus.ACTIVE
    total_occurrences = None
    generated_count = 0


class TransactionFactory(DjangoModelFactory):
    class Meta:
        model = Transaction

    user = factory.SubFactory(UserFactory)
    type = TransactionType.EXPENSE
    kind = TransactionKind.VARIABLE
    category = factory.SubFactory(CategoryFactory, user=factory.SelfAttribute("..user"))
    description = factory.Sequence(lambda n: f"Transação {n}")
    amount = Decimal("50.00")
    date = factory.LazyFunction(lambda: datetime.date(2025, 1, 15))
    payment_method = factory.SubFactory(
        PaymentMethodFactory, user=factory.SelfAttribute("..user")
    )
    is_paid = True


class DebtFactory(DjangoModelFactory):
    class Meta:
        model = Debt

    user = factory.SubFactory(UserFactory)
    debt_type = "installment"
    creditor = factory.Sequence(lambda n: f"Credor {n}")
    installment_current = 1
    installment_total = 12
    installment_amount = Decimal("100.00")
    total_amount = Decimal("1200.00")
    start_date = factory.LazyFunction(lambda: datetime.date(2025, 1, 1))
    is_settled = False


class InvestmentGoalFactory(DjangoModelFactory):
    class Meta:
        model = InvestmentGoal

    user = factory.SubFactory(UserFactory)
    year = 2025
    month = 1
    target_amount = Decimal("5000.00")


class InvestmentFactory(DjangoModelFactory):
    class Meta:
        model = Investment

    user = factory.SubFactory(UserFactory)
    year = 2025
    month = 1
    date = factory.LazyFunction(lambda: datetime.date(2025, 1, 10))
    location = factory.Sequence(lambda n: f"Fundo {n}")
    amount = Decimal("1000.00")


class CardFactory(DjangoModelFactory):
    class Meta:
        model = Card

    user = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: f"Cartão {n}")
    color = "#1a1a1a"
    closing_day = 12
    due_day = 19
    limit = None


class CardInvoiceFactory(DjangoModelFactory):
    class Meta:
        model = CardInvoice

    card = factory.SubFactory(CardFactory)
    year = 2025
    month = 1
    amount = Decimal("500.00")
    due_date = factory.LazyFunction(lambda: datetime.date(2025, 1, 19))
    is_paid = False


class AcquisitionFactory(DjangoModelFactory):
    class Meta:
        model = Acquisition

    user = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: f"Bem {n}")
    total_value = Decimal("10000.00")
    acquisition_type = AcquisitionType.FINANCING
    down_payment = Decimal("2000.00")
    installments_count = 24
    monthly_interest_rate = Decimal("1.9900")
    amortization_system = AmortizationSystem.PRICE
    extra_monthly_cost = Decimal("0.00")
    start_date = factory.LazyFunction(lambda: datetime.date(2026, 7, 1))
    status = AcquisitionStatus.SIMULATION


class AcquisitionInstallmentFactory(DjangoModelFactory):
    class Meta:
        model = AcquisitionInstallment

    acquisition = factory.SubFactory(AcquisitionFactory)
    number = 1
    due_date = factory.LazyFunction(lambda: datetime.date(2026, 7, 1))
    amount = Decimal("422.94")
    interest_portion = Decimal("159.20")
    principal_portion = Decimal("263.74")
    remaining_balance = Decimal("7736.26")
