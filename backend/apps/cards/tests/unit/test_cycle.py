import datetime

from apps.cards.cycle import (
    add_months,
    competence_for_purchase,
    cycle_range,
    invoice_due_date,
)


def test_add_months_rolls_year():
    assert add_months(2026, 12, 1) == (2027, 1)
    assert add_months(2026, 1, -1) == (2025, 12)


def test_purchase_after_closing_goes_to_next_month():
    assert competence_for_purchase(3, datetime.date(2026, 6, 5)) == (2026, 7)


def test_purchase_on_closing_day_stays_in_month():
    assert competence_for_purchase(3, datetime.date(2026, 6, 3)) == (2026, 6)


def test_purchase_year_rollover():
    assert competence_for_purchase(3, datetime.date(2026, 12, 15)) == (2027, 1)


def test_closing_day_clamped_in_short_month():
    assert competence_for_purchase(31, datetime.date(2026, 2, 28)) == (2026, 2)
    assert competence_for_purchase(31, datetime.date(2026, 3, 1)) == (2026, 3)


def test_cycle_range_spans_previous_closing():
    start, end = cycle_range(3, 2026, 7)
    assert start == datetime.date(2026, 6, 4)
    assert end == datetime.date(2026, 7, 3)


def test_due_day_after_closing_same_month():
    assert invoice_due_date(3, 10, 2026, 6) == datetime.date(2026, 6, 10)


def test_due_day_before_closing_next_month():
    assert invoice_due_date(28, 5, 2026, 6) == datetime.date(2026, 7, 5)
