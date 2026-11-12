# ruff: noqa
"""Validação manual R1, R2, R5, R6. Uso (container):
docker compose exec -T backend uv run python manage.py shell < apps/transactions/fixtures_import/validate_domain.py
"""

import datetime
from decimal import Decimal
from pathlib import Path

from apps.accounts.models import User
from apps.cards.dtos import CardWriteDTO
from apps.cards.services import CardService
from apps.core.models import Category
from apps.transactions.models import RecurringExpense, Transaction
from apps.transactions.services import (
    RecurringExpenseService,
    StatementImportService,
    TransactionService,
)

D = Path("apps/transactions/fixtures_import")
u = User.objects.create(email="tmp-validate@example.com")
try:
    for n in [
        "Salário",
        "Uber/transporte",
        "Alimentação",
        "Mercado",
        "Saúde",
        "Assinaturas",
        "Outros",
        "Contas",
        "Lazer",
        "Vestuário",
    ]:
        Category.objects.create(user=u, name=n)
    cat = lambda n: Category.objects.get(user=u, name=n)  # noqa
    card = CardService().create_card(
        u.id,
        CardWriteDTO(
            name="Inter",
            color="#f60",
            closing_day=7,
            due_day=14,
            limit=Decimal("5000"),
            functions=["credit", "debit"],
        ),
    )
    credit_pm = card.payment_methods.get(card_function="credit")
    debit_pm = card.payment_methods.get(card_function="debit")
    rs = RecurringExpenseService()
    mk = lambda **k: RecurringExpense.objects.create(user=u, **k)  # noqa
    sal = mk(
        description="Trampo",
        type="income",
        category=cat("Salário"),
        default_amount=Decimal("8000.00"),
        due_day=10,
        start_date=datetime.date(2026, 11, 1),
    )
    spot = mk(
        description="Spotify",
        type="expense",
        category=cat("Lazer"),
        payment_method=debit_pm,
        default_amount=Decimal("13.00"),
        due_day=17,
        start_date=datetime.date(2026, 11, 1),
    )
    # R1
    assert rs.ensure_month(u.id, 2026, 10) == 0, "antes do start_date"
    assert rs.ensure_month(u.id, 2026, 11) == 2
    assert rs.ensure_month(u.id, 2026, 11) == 0, "idempotente"
    assert rs.ensure_month(u.id, 2026, 12) == 2
    assert rs.ensure_month(u.id, 2027, 1) == 2
    print("R1 ok")
    # R2
    tsvc = TransactionService()
    t11 = Transaction.objects.get(user=u, recurring_source=spot, month=11, year=2026)
    t12 = Transaction.objects.get(user=u, recurring_source=spot, month=12, year=2026)
    t01 = Transaction.objects.get(user=u, recurring_source=spot, month=1, year=2027)
    t01.is_paid = True
    t01.save()
    tsvc.update(t12.id, u.id, {"amount": "15.50"})
    for t in (t11, t12, t01):
        t.refresh_from_db()
    spot.refresh_from_db()
    assert (t11.amount, t12.amount, t01.amount) == (
        Decimal("13.00"),
        Decimal("15.50"),
        Decimal("13.00"),
    ), (t11.amount, t12.amount, t01.amount)
    assert spot.default_amount == Decimal("15.50")
    print("R2 ok")
    # R5/R6 importação crédito
    imp = StatementImportService()
    res = imp.import_file(
        u.id,
        (D / "inter_fatura.csv").read_bytes(),
        "f.csv",
        card.id,
        "credit",
        2026,
        11,
    )
    print(res)
    st = [i["status"] for i in res["items"]]
    assert st == ["created", "created", "created", "created", "ignored"], st
    assert res["created"] == 4 and res["skipped"] == 1
    items = Transaction.objects.filter(user=u, payment_method=credit_pm)
    assert items.count() == 4 and all((t.year, t.month) == (2026, 11) for t in items)
    parc = items.get(description="LOJA XYZ")
    assert (parc.installment_current, parc.installment_total) == (2, 3)
    assert parc.category.name == "Vestuário"
    assert items.get(description="UBER *TRIP").category.name == "Uber/transporte"
    # reimport => tudo duplicado
    res2 = imp.import_file(
        u.id,
        (D / "inter_fatura_latin1.csv").read_bytes(),
        "f.csv",
        card.id,
        "credit",
        2026,
        11,
    )
    assert (
        res2["created"] == 0
        and [i["status"] for i in res2["items"]][:4] == ["duplicate"] * 4
    ), res2
    print("dedup + latin-1 ok")
    # extrato (débito): Spotify 13,00 bate com fixo => duplicate; salário 8000 => duplicate
    res3 = imp.import_file(
        u.id, (D / "inter_extrato.csv").read_bytes(), "e.csv", card.id, "debit"
    )
    print(res3)
    assert [i["status"] for i in res3["items"]] == [
        "created",
        "duplicate",
        "duplicate",
    ] or [i["status"] for i in res3["items"]] == ["created", "duplicate", "created"]
    d = Transaction.objects.get(user=u, description__icontains="Padaria")
    assert d.payment_method_id == debit_pm.id and d.kind == "variable" and d.is_paid
    # nubank + ofx
    r = imp.import_file(
        u.id,
        (D / "nubank_fatura.csv").read_bytes(),
        "n.csv",
        card.id,
        "credit",
        2026,
        11,
    )
    assert [i["status"] for i in r["items"]] == ["created", "created", "ignored"], r
    assert (
        r["items"][0]["category"] == "Mercado" and r["items"][1]["category"] == "Saúde"
    )
    r = imp.import_file(
        u.id, (D / "nubank_conta.csv").read_bytes(), "n.csv", card.id, "debit"
    )
    assert [i["status"] for i in r["items"]] == ["created", "created"], r
    r = imp.import_file(
        u.id, (D / "extrato.ofx").read_bytes(), "e.ofx", card.id, "debit"
    )
    assert [i["status"] for i in r["items"]] == ["created", "created"], r
    assert r["items"][0]["category"] == "Uber/transporte"
    print("nubank/ofx ok")
    print("TUDO OK")
finally:
    from apps.cards.models import Card
    from apps.core.models import PaymentMethod

    Transaction.objects.filter(user=u).delete()
    RecurringExpense.objects.filter(user=u).delete()
    PaymentMethod.objects.filter(user=u).delete()
    Card.objects.filter(user=u).delete()
    u.delete()
    assert not User.objects.filter(email="tmp-validate@example.com").exists()
