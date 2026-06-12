import pytest
from django.db import IntegrityError

from apps.common.factories import CardFactory, PaymentMethodFactory
from apps.core.models import CardFunction

pytestmark = pytest.mark.django_db


def test_payment_method_links_card_with_function():
    card = CardFactory()
    pm = PaymentMethodFactory(
        user=card.user, card=card, card_function=CardFunction.CREDIT
    )
    assert pm.card == card
    assert pm.card_function == "credit"


def test_card_function_requires_card():
    with pytest.raises(IntegrityError):
        PaymentMethodFactory(card=None, card_function=CardFunction.CREDIT)


def test_card_without_function_rejected():
    card = CardFactory()
    with pytest.raises(IntegrityError):
        PaymentMethodFactory(user=card.user, card=card, card_function=None)


def test_one_payment_method_per_function_per_card():
    card = CardFactory()
    PaymentMethodFactory(user=card.user, card=card, card_function=CardFunction.CREDIT)
    with pytest.raises(IntegrityError):
        PaymentMethodFactory(
            user=card.user, card=card, card_function=CardFunction.CREDIT
        )
