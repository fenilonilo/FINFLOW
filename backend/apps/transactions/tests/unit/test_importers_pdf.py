import datetime
from decimal import Decimal

import pytest

from apps.common.exceptions import ValidationDomainError
from apps.transactions import importers
from apps.transactions.importers import parse_inter_invoice_pdf, parse_statement

TEXT = """Data Movimentação Beneficiário Valor
19 de set. 2026 Fulano Silva (Parcela 02 de 02) - R$ 325,00
05 de out. 2026 LOJA EXEMPLO - R$ 1.005,50
09 de out. 2026 PAGAMENTO ON LINE - + R$ 996,14
17 de out. 2026 ACADEMIA TESTE - - R$ 99,90
15 de dez. 2025 MERCADO DEZ - R$ 10,00
02 de jan. 2026 PADARIA JAN - R$ 3,85
Total CARTÃO 0000****0000 R$ 993,91
Próxima fatura
JOGO X (Parcela 03 de 03) R$ 21,50
"""


def test_parse_inter_invoice_pdf_extracts_dated_lines() -> None:
    rows = parse_inter_invoice_pdf(TEXT)
    assert len(rows) == 6
    r = rows[0]
    assert r.date == datetime.date(2026, 9, 19)
    assert r.description == "Fulano Silva (Parcela 02 de 02)"
    assert (r.amount, r.outflow) == (Decimal("325.00"), True)
    assert (r.installment_current, r.installment_total) == (2, 2)
    assert rows[1].amount == Decimal("1005.50")
    assert rows[1].installment_current is None


def test_parse_inter_invoice_pdf_payment_is_inflow() -> None:
    r = parse_inter_invoice_pdf(TEXT)[2]
    assert r.description == "PAGAMENTO ON LINE"
    assert (r.amount, r.outflow) == (Decimal("996.14"), False)


def test_parse_inter_invoice_pdf_strips_trailing_hyphen() -> None:
    r = parse_inter_invoice_pdf(TEXT)[3]
    assert r.description == "ACADEMIA TESTE"
    assert (r.amount, r.outflow) == (Decimal("99.90"), True)


def test_parse_inter_invoice_pdf_months_dec_jan() -> None:
    rows = parse_inter_invoice_pdf(TEXT)
    assert rows[4].date == datetime.date(2025, 12, 15)
    assert rows[5].date == datetime.date(2026, 1, 2)


def test_installment_slash_format_still_works() -> None:
    assert importers._installment("Compra 3/10") == (3, 10)
    assert importers._installment("Parcela 03 de 10") == (3, 10)


def test_parse_statement_routes_pdf(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(importers, "_pdf_text", lambda b: TEXT)
    assert len(parse_statement(b"%PDF-1.4 ...", "fatura.pdf")) == 6


def test_parse_statement_pdf_without_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(importers, "_pdf_text", lambda b: "nada aqui")
    with pytest.raises(ValidationDomainError):
        parse_statement(b"%PDF-1.4 ...", "fatura.pdf")


def test_parse_statement_corrupt_pdf() -> None:
    with pytest.raises(ValidationDomainError):
        parse_statement(b"%PDF-1.4 garbage", "fatura.pdf")
