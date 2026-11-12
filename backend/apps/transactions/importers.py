"""Parsers puros de fatura/extrato (sem ORM, sem DRF).

Cada parser devolve linhas normalizadas: amount sempre positivo (Decimal) e
`outflow` indicando saída (compra/débito) ou entrada (crédito/estorno/pagamento).
"""

import csv
import datetime
import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from apps.common.exceptions import ValidationDomainError


@dataclass(frozen=True)
class ParsedRow:
    date: datetime.date
    description: str
    amount: Decimal
    outflow: bool
    bank_category: str | None = None
    installment_current: int | None = None
    installment_total: int | None = None


_INSTALLMENT = re.compile(r"(?:parcela\s*)?(\d{1,2})\s*/\s*(\d{1,2})", re.IGNORECASE)


def decode(file_bytes: bytes) -> str:
    try:
        return file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1")


def _norm(text: str) -> str:
    base = unicodedata.normalize("NFKD", text)
    return "".join(c for c in base if not unicodedata.combining(c)).strip().lower()


def parse_money(raw: str) -> Decimal:
    """'R$ 1.234,56' / '-R$ 50,00' / '-123.45' -> Decimal (com sinal)."""
    text = raw.strip().replace("R$", "").replace(" ", "").replace("\xa0", "")
    negative = text.startswith("-") or (text.startswith("(") and text.endswith(")"))
    text = text.strip("-+()")
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        value = Decimal(text)
    except InvalidOperation:
        raise ValidationDomainError({"file": [f"Valor inválido: {raw!r}"]})
    return -value if negative else value


def _parse_date(raw: str) -> datetime.date:
    raw = raw.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y"):
        try:
            return datetime.datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    raise ValidationDomainError({"file": [f"Data inválida: {raw!r}"]})


def _installment(*texts: str) -> tuple[int | None, int | None]:
    for text in texts:
        m = _INSTALLMENT.search(text or "")
        if m and 1 <= int(m.group(1)) <= int(m.group(2)):
            return int(m.group(1)), int(m.group(2))
    return None, None


def _read_dicts(text: str, header_marker: str | None = None) -> list[dict[str, str]]:
    lines = text.splitlines()
    start = 0
    if header_marker:
        start = next((i for i, ln in enumerate(lines) if header_marker in _norm(ln)), 0)
    body = [ln for ln in lines[start:] if ln.strip()]
    if not body:
        return []
    delim = ";" if body[0].count(";") > body[0].count(",") else ","
    reader = csv.reader(body, delimiter=delim)
    header = [_norm(h) for h in next(reader)]
    return [
        dict(zip(header, (c.strip() for c in row), strict=False))
        for row in reader
        if row
    ]


def _signed_row(
    date: datetime.date,
    description: str,
    signed: Decimal,
    outflow_if_positive: bool,
    **kw: object,
) -> ParsedRow:
    outflow = (signed > 0) == outflow_if_positive
    return ParsedRow(
        date=date,
        description=description,
        amount=abs(signed),
        outflow=outflow,
        **kw,  # type: ignore[arg-type]
    )


def parse_inter_invoice(text: str) -> list[ParsedRow]:
    rows = []
    for r in _read_dicts(text):
        if not r.get("data") or not r.get("valor"):
            continue
        desc = r.get("lancamento", "")
        cur, tot = _installment(r.get("tipo", ""), desc)
        rows.append(
            _signed_row(
                _parse_date(r["data"]),
                desc,
                parse_money(r["valor"]),
                True,
                bank_category=r.get("categoria") or None,
                installment_current=cur,
                installment_total=tot,
            )
        )
    return rows


def parse_inter_statement(text: str) -> list[ParsedRow]:
    rows = []
    for r in _read_dicts(text, header_marker="data lancamento"):
        if not r.get("data lancamento") or not r.get("valor"):
            continue
        parts = [r.get("historico", ""), r.get("descricao", "")]
        desc = " - ".join(p for p in parts if p)
        rows.append(
            _signed_row(
                _parse_date(r["data lancamento"]),
                desc,
                parse_money(r["valor"]),
                False,
            )
        )
    return rows


def parse_nubank_invoice(text: str) -> list[ParsedRow]:
    rows = []
    for r in _read_dicts(text):
        if not r.get("date") or not r.get("amount"):
            continue
        title = r.get("title", "")
        cur, tot = _installment(title)
        rows.append(
            _signed_row(
                _parse_date(r["date"]),
                title,
                parse_money(r["amount"]),
                True,
                installment_current=cur,
                installment_total=tot,
            )
        )
    return rows


def parse_nubank_account(text: str) -> list[ParsedRow]:
    rows = []
    for r in _read_dicts(text):
        if not r.get("data") or not r.get("valor"):
            continue
        rows.append(
            _signed_row(
                _parse_date(r["data"]),
                r.get("descricao", ""),
                parse_money(r["valor"]),
                False,
            )
        )
    return rows


_OFX_BLOCK = re.compile(
    r"<STMTTRN>(.*?)(?=</STMTTRN>|<STMTTRN>|</BANKTRANLIST>|\Z)",
    re.IGNORECASE | re.DOTALL,
)


def _ofx_tag(block: str, tag: str) -> str:
    m = re.search(rf"<{tag}>\s*([^<\r\n]*)", block, re.IGNORECASE)
    return m.group(1).strip() if m else ""


def parse_ofx(text: str) -> list[ParsedRow]:
    rows = []
    for block in _OFX_BLOCK.findall(text):
        posted = _ofx_tag(block, "DTPOSTED")[:8]
        amount = _ofx_tag(block, "TRNAMT")
        if not posted or not amount:
            continue
        date = datetime.datetime.strptime(posted, "%Y%m%d").date()
        desc = _ofx_tag(block, "MEMO") or _ofx_tag(block, "NAME")
        cur, tot = _installment(desc)
        rows.append(
            _signed_row(
                date,
                desc,
                parse_money(amount.replace(",", ".")),
                False,
                installment_current=cur,
                installment_total=tot,
            )
        )
    return rows


def detect_format(text: str, filename: str = "") -> str:
    head = _norm(text[:4000])
    if "<ofx" in head or "ofxheader" in head or filename.lower().endswith(".ofx"):
        return "ofx"
    first = next((ln for ln in _norm(text).splitlines() if ln.strip()), "")
    cols = {c.strip() for c in re.split(r"[;,]", first)}
    if "data lancamento" in head:
        return "inter_statement"
    if {"data", "lancamento", "categoria", "tipo", "valor"} <= cols:
        return "inter_invoice"
    if {"date", "title", "amount"} <= cols:
        return "nubank_invoice"
    if {"data", "valor", "identificador"} <= cols:
        return "nubank_account"
    raise ValidationDomainError({"file": ["Formato de arquivo não reconhecido."]})


_PARSERS = {
    "ofx": parse_ofx,
    "inter_statement": parse_inter_statement,
    "inter_invoice": parse_inter_invoice,
    "nubank_invoice": parse_nubank_invoice,
    "nubank_account": parse_nubank_account,
}


def parse_statement(file_bytes: bytes, filename: str = "") -> list[ParsedRow]:
    text = decode(file_bytes)
    return _PARSERS[detect_format(text, filename)](text)
