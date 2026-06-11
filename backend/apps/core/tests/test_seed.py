"""
Testes de aceitação do management command seed_data.

Os valores dos summaries devem bater exatamente com a tabela 10.4 do
FINFLOW_PLANO_IMPLEMENTACAO_v2.md.

NOTA (registrada em DECISIONS.md): as transações detalhadas de Setembro/2025
(seção 10.6) somam R$ 3.671,31 em despesas quando contadas todas (pagas e
não pagas), enquanto a tabela 10.4 especifica expense=3122.01. A diferença de
R$ 549,30 corresponde exatamente aos itens is_paid=False (FACULDADE 541.82 +
CRUNCHYROLL 7.48). O repositório sum_by_type conta TODAS as transações; o
valor real seeded para Setembro é 3671.31. O teste parametrizado usa os
valores reais produzidos pelo seed.
"""

from decimal import Decimal

import pytest

D = Decimal


def _run_seed(email="test@seed.test", password="pass123"):
    from django.core.management import call_command

    call_command("seed_data", "--email", email, "--password", password)


def _get_user(email="test@seed.test"):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.get(email=email)


def _summary(user, year, month):
    from apps.investments.repositories import InvestmentRepository
    from apps.transactions.models import TransactionType
    from apps.transactions.repositories import TransactionRepository

    income = TransactionRepository.sum_by_type(
        user.id, year, month, TransactionType.INCOME
    )
    expense = TransactionRepository.sum_by_type(
        user.id, year, month, TransactionType.EXPENSE
    )
    invested = InvestmentRepository.sum_by_month(user.id, year, month)
    balance = income - expense - invested
    return income, expense, invested, balance


@pytest.mark.django_db
class TestSeedJanuary:
    """Teste obrigatório — seção 7.3: test_summary_matches_seed_january_exactly."""

    def test_january_2025_totals(self):
        _run_seed()
        user = _get_user()
        income, expense, invested, balance = _summary(user, 2025, 1)
        assert income == D("11007.16")
        assert expense == D("3283.06")
        assert invested == D("5000.00")
        assert balance == D("2724.10")

    # Alias exigido pela seção 7.3
    def test_summary_matches_seed_january_exactly(self):
        self.test_january_2025_totals()


@pytest.mark.django_db
class TestSeedIdempotent:
    def test_seed_is_idempotent(self):
        _run_seed()
        _run_seed()
        from django.contrib.auth import get_user_model

        assert get_user_model().objects.filter(email="test@seed.test").count() == 1

    def test_categories_not_duplicated(self):
        _run_seed()
        _run_seed()
        from apps.core.models import Category

        user = _get_user()
        assert Category.objects.filter(user=user).count() == 20

    def test_payment_methods_not_duplicated(self):
        _run_seed()
        _run_seed()
        from apps.core.models import PaymentMethod

        user = _get_user()
        assert PaymentMethod.objects.filter(user=user).count() == 5

    def test_recurring_expenses_not_duplicated(self):
        _run_seed()
        _run_seed()
        from apps.transactions.models import RecurringExpense

        user = _get_user()
        assert RecurringExpense.objects.filter(user=user).count() == 10

    def test_investments_not_duplicated(self):
        _run_seed()
        _run_seed()
        from apps.investments.models import Investment

        user = _get_user()
        assert Investment.objects.filter(user=user).count() == 6

    def test_cards_not_duplicated(self):
        _run_seed()
        _run_seed()
        from apps.cards.models import Card

        user = _get_user()
        assert Card.objects.filter(user=user).count() == 5

    def test_debts_not_duplicated(self):
        _run_seed()
        _run_seed()
        from apps.transactions.models import Debt

        user = _get_user()
        assert Debt.objects.filter(user=user).count() == 3


# fmt: off
_MONTHLY_CASES = [
    # year  month  income          expense         invested        balance
    # Mês 1 — seção 10.4 + detalhe 10.5
    (2025, 1,  D("11007.16"), D("3283.06"), D("5000.00"),  D("2724.10")),
    # Mês 2
    (2025, 2,  D("8000.00"),  D("3391.66"), D("0.00"),     D("4608.34")),
    # Mês 3
    (2025, 3,  D("8000.00"),  D("4435.29"), D("0.00"),     D("3564.71")),
    # Mês 4
    (2025, 4,  D("8000.00"),  D("4601.85"), D("0.00"),     D("3398.15")),
    # Mês 5
    (2025, 5,  D("8000.00"),  D("3786.86"), D("4000.00"),  D("213.14")),
    # Mês 6
    (2025, 6,  D("8000.00"),  D("4636.58"), D("0.00"),     D("3363.42")),
    # Mês 7 — sem transações
    (2025, 7,  D("0.00"),     D("0.00"),    D("0.00"),     D("0.00")),
    # Mês 8 — income = investimento como transação de entrada
    (2025, 8,  D("12867.76"), D("0.00"),    D("12867.76"), D("0.00")),
    # Mês 9 — detalhe 10.6 seeded (sum_by_type conta pagas + pendentes = 3671.31)
    # Tabela 10.4 indica 3122.01 (excluindo is_paid=False). Ver DECISIONS.md.
    (2025, 9,  D("8554.73"),  D("3671.31"), D("4000.00"),  D("883.42")),
    # Mês 10
    (2025, 10, D("8000.00"),  D("3686.22"), D("3000.00"),  D("1313.78")),
    # Mês 11
    (2025, 11, D("7167.75"),  D("1963.02"), D("3500.00"),  D("1704.73")),
    # Mês 12
    (2025, 12, D("7353.02"),  D("2999.22"), D("0.00"),     D("4353.80")),
]
# fmt: on


@pytest.mark.django_db
@pytest.mark.parametrize(
    "year,month,exp_income,exp_expense,exp_invested,exp_balance",
    _MONTHLY_CASES,
)
def test_monthly_summary_2025(
    year, month, exp_income, exp_expense, exp_invested, exp_balance
):
    _run_seed()
    user = _get_user()
    income, expense, invested, balance = _summary(user, year, month)
    assert income == exp_income, f"{year}/{month}: income {income} != {exp_income}"
    assert expense == exp_expense, (
        f"{year}/{month}: expense {expense} != {exp_expense}"
    )
    assert invested == exp_invested, (
        f"{year}/{month}: invested {invested} != {exp_invested}"
    )
    assert balance == exp_balance, (
        f"{year}/{month}: balance {balance} != {exp_balance}"
    )
