import datetime

import pytest

from apps.common.factories import TransactionFactory

pytestmark = pytest.mark.django_db


def test_save_derives_competence_from_date_when_missing():
    tx = TransactionFactory(date=datetime.date(2026, 6, 5))
    assert (tx.year, tx.month) == (2026, 6)


def test_save_respects_preset_competence():
    tx = TransactionFactory(date=datetime.date(2026, 6, 5), year=2026, month=7)
    assert (tx.year, tx.month) == (2026, 7)
