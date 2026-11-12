import datetime
from decimal import Decimal

import pytest

from apps.common.factories import CardFactory, CategoryFactory, UserFactory
from apps.transactions import services
from apps.transactions.importers import ParsedRow
from apps.transactions.services import StatementImportService

pytestmark = pytest.mark.django_db


def test_import_llm_category_beats_bank_category_but_not_keyword(monkeypatch):
    user = UserFactory()
    card = CardFactory(user=user)
    for name in ("Mercado", "Lazer", "Uber/transporte"):
        CategoryFactory(user=user, name=name)
    d = datetime.date(2025, 3, 5)
    rows = [
        ParsedRow(d, "CINEMARK SP", Decimal("50"), True, bank_category="Lazer"),
        ParsedRow(d, "UBER *TRIP", Decimal("20"), True, bank_category="Lazer"),
    ]
    monkeypatch.setattr(services, "parse_statement", lambda b, f: rows)
    sent = []

    def fake_classify(descriptions, categories):
        sent.append((descriptions, categories))
        return ["Mercado"] * len(descriptions)

    monkeypatch.setattr(services, "classify", fake_classify)

    result = StatementImportService().import_file(
        user.id, b"", "f.csv", card.id, "credit", 2025, 3
    )

    cats = {i["description"]: i["category"] for i in result["items"]}
    assert cats == {"CINEMARK SP": "Mercado", "UBER *TRIP": "Uber/transporte"}
    assert len(sent) == 1
    assert sent[0][0] == ["CINEMARK SP"]
    assert "Lazer" in sent[0][1]


def test_credit_import_does_not_touch_card_linked_fixed(monkeypatch):
    """Fatura de cartão não é mais fixo: import não reescreve o valor do template."""
    from apps.common.factories import RecurringExpenseFactory
    from apps.transactions.models import Transaction

    user = UserFactory()
    card = CardFactory(user=user)
    tpl = RecurringExpenseFactory(user=user, card=card, default_amount=Decimal("100"))
    rows = [ParsedRow(datetime.date(2025, 3, 5), "LOJA X", Decimal("40"), True)]
    monkeypatch.setattr(services, "parse_statement", lambda b, f: rows)
    monkeypatch.setattr(services, "classify", lambda d, c: [None] * len(d))
    services.RecurringExpenseService().ensure_month(user.id, 2025, 3)

    StatementImportService().import_file(
        user.id, b"", "f.csv", card.id, "credit", 2025, 3
    )

    tx = Transaction.objects.get(recurring_source=tpl, year=2025, month=3)
    assert tx.amount == Decimal("100")


def test_expense_sums_count_card_items_and_card_linked_fixed():
    """Sem R4: somas não excluem itens de crédito nem a transação do fixo."""
    from apps.common.factories import (
        PaymentMethodFactory,
        RecurringExpenseFactory,
        TransactionFactory,
    )
    from apps.core.models import CardFunction
    from apps.transactions.repositories import TransactionRepository as R

    user = UserFactory()
    card = CardFactory(user=user)
    pm = PaymentMethodFactory(user=user, card=card, card_function=CardFunction.CREDIT)
    tpl = RecurringExpenseFactory(user=user, card=card)
    TransactionFactory(
        user=user,
        year=2025,
        month=3,
        amount=Decimal("100"),
        recurring_source=tpl,
        kind="fixed",
    )
    TransactionFactory(
        user=user, year=2025, month=3, amount=Decimal("40"), payment_method=pm
    )

    assert R.sum_by_type(user.id, 2025, 3, "expense") == Decimal("140")
    assert sum(r["total"] for r in R.sum_by_category(user.id, 2025, 3)) == Decimal(
        "140"
    )


NUBANK_NOV_2026 = """date,title,amount
2026-11-04,Dl *Uberrides,"23,01"
2026-11-04,Uber - NuPay,"- 8,94"
2026-11-04,Uber - NuPay,"8,94"
2026-11-04,Posto Praca do Aviao,"50,00"
2026-11-04,Uber - NuPay,"9,93"
2026-11-04,Dl *Uberrides,"37,94"
2026-11-03,Vikings Pub,"48,15"
2026-11-03,Uber - NuPay,"10,93"
2026-11-03,Uber - NuPay,"10,96"
2026-10-31,Uber - NuPay,"1,50"
2026-10-31,Uber - NuPay,"14,96"
2026-10-29,Uber - NuPay,"15,94"
2026-10-29,Uber - NuPay,"23,93"
2026-10-29,99Food - NuPay,"25,36"
2026-10-28,Posto Aldeia,"100,00"
2026-10-28,Uber - NuPay,"13,46"
2026-10-28,Newlife Protecao,"20,00"
2026-10-28,Drogasil,"16,84"
2026-10-28,Uber - NuPay,"18,88"
2026-10-27,Solar Combustiveis,"100,00"
2026-10-27,Uber - NuPay,"22,45"
2026-10-27,Valori Ltda *Melo Pani,"20,38"
2026-10-23,Uber - NuPay,"41,95"
2026-10-23,Uber - NuPay,"9,95"
2026-10-20,Uber - NuPay,"10,94"
2026-10-19,iFood - NuPay,"27,89"
2026-10-19,iFood - NuPay,"14,75"
2026-10-17,Uber - NuPay,"14,95"
2026-10-09,Pagamento recebido,"- 204,11"
2026-10-07,Uber - NuPay,"- 11,96"
2026-10-07,Google Cloud Swnz9s,"150,00"
2026-10-07,Uber - NuPay,"12,94"
2026-10-07,Uber - NuPay,"10,95"
2026-10-07,Uber - NuPay,"11,96"
2026-10-06,Reginamariadelima,"18,00"
2026-10-06,Ilmaselesdasilva,"3,50"
2026-10-05,EBW*HBO MAX II - NuPay - Parcela 4/12,"34,90"
"""


def test_credit_import_refund_cancels_matching_purchase(monkeypatch):
    """Estorno na fatura anula a compra de mesmo valor/descrição (Nubank nov/26)."""
    from apps.transactions.models import Transaction

    user = UserFactory()
    card = CardFactory(user=user)
    monkeypatch.setattr(services, "classify", lambda d, c: [None] * len(d))

    result = StatementImportService().import_file(
        user.id,
        NUBANK_NOV_2026.encode(),
        "Nubank_2026-11-12.csv",
        card.id,
        "credit",
        2026,
        11,
    )

    expenses = Transaction.objects.filter(user=user, type="expense")
    assert sum(t.amount for t in expenses) == Decimal("935.34")
    assert Decimal(result["total"]) == Decimal("935.34")
    refunded = [i for i in result["items"] if i["status"] == "refunded"]
    assert sorted((i["amount"], i["date"]) for i in refunded) == [
        ("11.96", "2026-10-07"),
        ("11.96", "2026-10-07"),
        ("8.94", "2026-11-04"),
        ("8.94", "2026-11-04"),
    ]
    status = {i["description"]: i["status"] for i in result["items"]}
    assert status["Pagamento recebido"] == "ignored"
    assert result["skipped"] == 5
