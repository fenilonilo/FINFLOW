"""Tools MCP: adapter fino sobre services/repositories (sem regra de negócio)."""

import datetime
import hashlib
import os
from decimal import Decimal, InvalidOperation
from typing import Any

from apps.accounts.repositories import UserRepository
from apps.cards.services import CardInvoiceService
from apps.common.dtos import CreateTransactionDTO
from apps.common.exceptions import DomainError, ValidationDomainError
from apps.core.repositories import CategoryRepository, PaymentMethodRepository
from apps.transactions.models import TransactionKind, TransactionType
from apps.transactions.repositories import (
    RecurringExpenseRepository,
    TransactionRepository,
)
from apps.transactions.services import (
    MonthSummaryService,
    RecurringExpenseService,
    TransactionService,
)


class ToolError(Exception):
    """Mensagem legível para o LLM."""


def owner_id() -> int:
    email = os.environ["FINFLOW_MCP_USER_EMAIL"]
    uid = UserRepository.get_id_by_email(email)
    if uid is None:
        raise ToolError(f"Usuário dono '{email}' não existe.")
    return uid


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value))
    except InvalidOperation:
        raise ToolError(f"Valor inválido: {value!r}. Use string decimal, ex.: 1234.56")


def _m(value: Decimal) -> str:
    return str(Decimal(value).quantize(Decimal("0.01")))


def _date(value: str) -> datetime.date:
    try:
        return datetime.date.fromisoformat(value)
    except ValueError:
        raise ToolError(f"Data inválida: {value!r}. Use ISO, ex.: 2026-11-25")


def _type(value: str) -> str:
    if value not in TransactionType.values:
        raise ToolError("type deve ser 'income' ou 'expense'.")
    return value


def _by_name(items: list[Any], name: str | None, label: str) -> Any:
    if not name:
        return None
    for item in items:
        if item.name.casefold() == name.strip().casefold():
            return item
    options = ", ".join(i.name for i in items) or "(nenhuma)"
    raise ToolError(f"{label} '{name}' não encontrada. Opções: {options}.")


def _lookups(uid: int, category: str | None, payment_method: str | None):
    cat = _by_name(CategoryRepository.list_by_user(uid), category, "Categoria")
    pm = _by_name(
        PaymentMethodRepository.list_by_user(uid), payment_method, "Forma de pagamento"
    )
    return cat, pm


def _name_maps(uid: int) -> tuple[dict[int, str], dict[int, str]]:
    cats = CategoryRepository.list_by_user(uid, include_archived=True)
    pms = PaymentMethodRepository.list_by_user(uid, include_archived=True)
    return {c.id: c.name for c in cats}, {p.id: p.name for p in pms}


def _tx_dict(tx: Any, cats: dict[int, str], pms: dict[int, str]) -> dict[str, Any]:
    return {
        "id": tx.id,
        "date": tx.date.isoformat(),
        "description": tx.description,
        "amount": _m(tx.amount),
        "type": tx.type,
        "category": cats.get(tx.category_id),
        "payment_method": pms.get(tx.payment_method_id),
        "is_fixed": tx.recurring_source_id is not None,
        "is_paid": tx.is_paid,
    }


def _today_ym() -> tuple[int, int]:
    t = datetime.date.today()
    return t.year, t.month


def month_summary(year: int, month: int) -> dict[str, Any]:
    """Resumo financeiro do mês (year + month 1-12): entradas, saídas, saldo,
    fixos, variáveis, totais por categoria e por forma de pagamento.
    Valores monetários são strings decimais."""
    uid = owner_id()
    RecurringExpenseService().ensure_month(uid, year, month)
    s = MonthSummaryService().get_summary(uid, year, month)
    return {
        "year": year,
        "month": month,
        "income": _m(s.total_income),
        "expense": _m(s.total_expense),
        "balance": _m(s.balance),
        "fixed": _m(s.total_fixed),
        "variable": _m(s.total_variable),
        "pending_count": s.pending_count,
        "by_category": [
            {"category": c["category__name"], "total": _m(c["total"])}
            for c in s.by_category
        ],
        "by_payment_method": [
            {"payment_method": p["payment_method__name"], "total": _m(p["total"])}
            for p in s.by_payment_method
        ],
    }


def list_transactions(
    year: int, month: int, type: str | None = None
) -> list[dict[str, Any]]:
    """Lista os lançamentos do mês (year + month). Filtro opcional type:
    'income' (entrada) ou 'expense' (saída). Crédito de cartão aparece na
    competência da fatura."""
    uid = owner_id()
    RecurringExpenseService().ensure_month(uid, year, month)
    filters = {"type": _type(type)} if type else {}
    cats, pms = _name_maps(uid)
    txs = TransactionRepository.list_by_month(uid, year, month, **filters)
    txs.sort(key=lambda t: (t.date, t.id))
    return [_tx_dict(t, cats, pms) for t in txs]


def add_transaction(
    type: str,
    description: str,
    amount: str,
    date: str,
    category: str | None = None,
    payment_method: str | None = None,
    is_paid: bool = False,
    key: str | None = None,
) -> dict[str, Any]:
    """Cria um lançamento avulso (variável). type: 'income' ou 'expense';
    amount: string decimal '1234.56'; date: ISO 'YYYY-MM-DD'. category e
    payment_method são NOMES (case-insensitive); categoria é obrigatória em
    despesas. Entradas são sempre pagas. key (opcional) torna a chamada
    idempotente: repetir a mesma key devolve o lançamento existente com
    created=false. Compra no crédito cai na competência da fatura."""
    uid = owner_id()
    import_key = None
    if key:
        import_key = f"mcp:{hashlib.sha1(key.encode()).hexdigest()}"[:64]
        existing = TransactionRepository.get_by_import_key(uid, import_key)
        if existing:
            cats, pms = _name_maps(uid)
            return {**_tx_dict(existing, cats, pms), "created": False}
    cat, pm = _lookups(uid, category, payment_method)
    tx = TransactionService().create(
        CreateTransactionDTO(
            user_id=uid,
            type=_type(type),
            kind=TransactionKind.VARIABLE,
            description=description,
            amount=_money(amount),
            date=_date(date),
            category_id=cat.id if cat else None,
            payment_method_id=pm.id if pm else None,
            is_paid=is_paid,
            import_key=import_key,
        )
    )
    cats, pms = _name_maps(uid)
    return {**_tx_dict(tx, cats, pms), "created": True}


def update_transaction(
    id: int,
    amount: str | None = None,
    is_paid: bool | None = None,
    description: str | None = None,
) -> dict[str, Any]:
    """Altera valor, status de pago e/ou descrição de um lançamento pelo id.
    Alterar o valor de um fixo propaga ao modelo e aos meses seguintes não pagos."""
    uid = owner_id()
    data: dict[str, Any] = {}
    if amount is not None:
        data["amount"] = _money(amount)
    if is_paid is not None:
        data["is_paid"] = is_paid
    if description is not None:
        data["description"] = description
    if not data:
        raise ToolError("Informe ao menos um campo: amount, is_paid ou description.")
    tx = TransactionService().update(id, uid, data)
    cats, pms = _name_maps(uid)
    return _tx_dict(tx, cats, pms)


def list_fixed() -> list[dict[str, Any]]:
    """Lista os gastos/entradas fixos recorrentes ativos (modelos mensais)."""
    uid = owner_id()
    RecurringExpenseService().ensure_month(uid, *_today_ym())
    cats, pms = _name_maps(uid)
    return [
        {
            "id": r.id,
            "type": r.type,
            "description": r.description,
            "amount": str(r.default_amount) if r.default_amount is not None else None,
            "due_day": r.due_day,
            "category": cats.get(r.category_id),
            "payment_method": pms.get(r.payment_method_id),
            "start_date": r.start_date.isoformat() if r.start_date else None,
        }
        for r in RecurringExpenseRepository.list_active(uid)
    ]


def add_fixed(
    type: str,
    description: str,
    amount: str,
    due_day: int,
    category: str | None = None,
    payment_method: str | None = None,
) -> dict[str, Any]:
    """Cria um fixo mensal (type 'income' ou 'expense'; due_day 1-28; amount
    string decimal). Começa no mês atual e já gera o lançamento do mês.
    category/payment_method são NOMES. Fatura de cartão não é fixo: gastos de
    cartão vêm dos itens importados da fatura."""
    uid = owner_id()
    if not 1 <= due_day <= 28:
        raise ToolError("due_day deve estar entre 1 e 28.")
    amt = _money(amount)
    if amt <= 0:
        raise ToolError("amount deve ser maior que zero.")
    cat, pm = _lookups(uid, category, payment_method)
    start = datetime.date.today().replace(day=1)
    rec = RecurringExpenseRepository.create(
        {
            "user_id": uid,
            "type": _type(type),
            "description": description,
            "default_amount": amt,
            "due_day": due_day,
            "category_id": cat.id if cat else None,
            "payment_method_id": pm.id if pm else None,
            "start_date": start,
        }
    )
    RecurringExpenseService().ensure_month(uid, start.year, start.month)
    return {"id": rec.id, "description": rec.description, "amount": str(amt)}


def list_categories() -> list[dict[str, Any]]:
    """Lista as categorias disponíveis (use o nome em add_transaction)."""
    return [
        {"id": c.id, "name": c.name}
        for c in CategoryRepository.list_by_user(owner_id())
    ]


def list_payment_methods() -> list[dict[str, Any]]:
    """Lista as formas de pagamento (use o nome em add_transaction)."""
    return [
        {"id": p.id, "name": p.name, "card_function": p.card_function}
        for p in PaymentMethodRepository.list_by_user(owner_id())
    ]


def card_invoices(year: int, month: int) -> list[dict[str, Any]]:
    """Cartões com limite, comprometido e fatura da competência year+month."""
    uid = owner_id()
    RecurringExpenseService().ensure_month(uid, year, month)
    return [
        {
            "card": c.name,
            "limit": str(c.limit) if c.limit is not None else None,
            "committed": _m(c.committed),
            "committed_pct": (
                str(c.committed_pct) if c.committed_pct is not None else None
            ),
            "open_cycle_spend": _m(c.open_cycle_spend),
            "closing_day": c.closing_day,
            "due_day": c.due_day,
            "invoice": {
                "amount": _m(c.invoice.amount),
                "is_paid": c.invoice.is_paid,
                "cycle_start": c.invoice.cycle_start.isoformat(),
                "cycle_end": c.invoice.cycle_end.isoformat(),
                "due_date": c.invoice.due_date.isoformat(),
            },
        }
        for c in CardInvoiceService().summary(uid, year, month)
    ]


def format_error(exc: Exception) -> str | None:
    """Mensagem legível para erros de domínio; None se não for de domínio."""
    if isinstance(exc, ValidationDomainError):
        return "; ".join(f"{k}: {' '.join(v)}" for k, v in exc.errors.items())
    if isinstance(exc, (DomainError, ToolError)):
        return str(exc)
    return None


ALL_TOOLS = [
    month_summary,
    list_transactions,
    add_transaction,
    update_transaction,
    list_fixed,
    add_fixed,
    list_categories,
    list_payment_methods,
    card_invoices,
]
