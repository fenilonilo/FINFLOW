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
