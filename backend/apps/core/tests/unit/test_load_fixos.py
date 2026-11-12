import pytest
from django.core.management import call_command

from apps.cards.models import Card
from apps.common.factories import (
    CardFactory,
    RecurringExpenseFactory,
    TransactionFactory,
    UserFactory,
)
from apps.core.management.commands.load_fixos import EMAIL
from apps.transactions.models import RecurringExpense, Transaction

pytestmark = pytest.mark.django_db


def test_load_fixos_removes_card_linked_fixed_and_is_idempotent():
    user = UserFactory(email=EMAIL)
    card = CardFactory(user=user, name="Inter")
    tpl = RecurringExpenseFactory(user=user, card=card, description="Inter")
    tx = TransactionFactory(user=user, recurring_source=tpl, kind="fixed")

    call_command("load_fixos")
    call_command("load_fixos")

    assert not RecurringExpense.objects.filter(user=user, card__isnull=False).exists()
    assert not Transaction.objects.filter(id=tx.id).exists()
    descs = set(
        RecurringExpense.objects.filter(user=user).values_list("description", flat=True)
    )
    assert not descs & {"Inter", "Nubank"}
    assert set(Card.objects.filter(user=user).values_list("name", flat=True)) == {
        "Inter",
        "Nubank",
    }
