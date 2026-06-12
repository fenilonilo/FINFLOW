from decimal import Decimal

import pytest

from apps.cards.dtos import CardWriteDTO
from apps.cards.services import CardService
from apps.common.exceptions import ValidationDomainError
from apps.common.factories import UserFactory
from apps.core.models import PaymentMethod

pytestmark = pytest.mark.django_db


def _dto(**overrides):
    base = dict(
        name="Nubank",
        color="#820ad1",
        closing_day=3,
        due_day=10,
        limit=Decimal("5000.00"),
        functions=["credit", "debit"],
    )
    base.update(overrides)
    return CardWriteDTO(**base)


def test_create_card_creates_payment_methods():
    user = UserFactory()
    card = CardService().create_card(user.id, _dto())
    pms = PaymentMethod.objects.filter(card=card).order_by("card_function")
    assert [pm.name for pm in pms] == ["Nubank Crédito", "Nubank Débito"]
    assert all(pm.color == "#820ad1" for pm in pms)
    assert card.limit == Decimal("5000.00")


def test_create_card_without_functions_fails():
    user = UserFactory()
    with pytest.raises(ValidationDomainError):
        CardService().create_card(user.id, _dto(functions=[]))


def test_update_card_renames_and_propagates():
    user = UserFactory()
    card = CardService().create_card(user.id, _dto())
    CardService().update_card(card.id, user.id, _dto(name="Inter", color="#ff7a00"))
    names = set(
        PaymentMethod.objects.filter(card=card).values_list("name", flat=True)
    )
    assert names == {"Inter Crédito", "Inter Débito"}


def test_update_card_removing_function_archives_it():
    user = UserFactory()
    card = CardService().create_card(user.id, _dto())
    CardService().update_card(card.id, user.id, _dto(functions=["credit"]))
    debit = PaymentMethod.objects.get(card=card, card_function="debit")
    assert debit.is_archived is True
    # re-adicionar reativa em vez de duplicar
    CardService().update_card(card.id, user.id, _dto(functions=["credit", "debit"]))
    debit.refresh_from_db()
    assert debit.is_archived is False
    assert PaymentMethod.objects.filter(card=card).count() == 2


def test_delete_card_archives_and_detaches_payment_methods():
    user = UserFactory()
    card = CardService().create_card(user.id, _dto())
    pm_ids = list(
        PaymentMethod.objects.filter(card=card).values_list("id", flat=True)
    )
    CardService().delete_card(card.id, user.id)
    for pm in PaymentMethod.objects.filter(id__in=pm_ids):
        assert pm.is_archived is True
        assert pm.card is None
        assert pm.card_function is None
