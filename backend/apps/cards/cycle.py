"""Funções puras do ciclo de fatura. Sem ORM, sem side effects."""

import calendar
import datetime


def clamp_day(year: int, month: int, day: int) -> datetime.date:
    last = calendar.monthrange(year, month)[1]
    return datetime.date(year, month, min(day, last))


def add_months(year: int, month: int, delta: int) -> tuple[int, int]:
    idx = (year * 12 + month - 1) + delta
    return idx // 12, idx % 12 + 1


def competence_for_purchase(
    closing_day: int, purchase_date: datetime.date
) -> tuple[int, int]:
    """Mês da fatura (competência) que contém a data da compra."""
    closing = clamp_day(purchase_date.year, purchase_date.month, closing_day)
    if purchase_date <= closing:
        return purchase_date.year, purchase_date.month
    return add_months(purchase_date.year, purchase_date.month, 1)


def cycle_range(
    closing_day: int, year: int, month: int
) -> tuple[datetime.date, datetime.date]:
    """Janela de compras da fatura de (year, month)."""
    prev_year, prev_month = add_months(year, month, -1)
    start = clamp_day(prev_year, prev_month, closing_day) + datetime.timedelta(days=1)
    end = clamp_day(year, month, closing_day)
    return start, end


def invoice_due_date(
    closing_day: int, due_day: int, year: int, month: int
) -> datetime.date:
    if due_day > closing_day:
        return clamp_day(year, month, due_day)
    next_year, next_month = add_months(year, month, 1)
    return clamp_day(next_year, next_month, due_day)
