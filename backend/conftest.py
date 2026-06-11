import pytest
from rest_framework.test import APIClient

from apps.common.factories import CategoryFactory, PaymentMethodFactory, UserFactory


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def categories_default(user):
    names = [
        "Saúde",
        "Alimentação",
        "Lazer",
        "Outros",
        "Transporte",
        "Essencial",
        "Contas",
        "Imposto",
        "Educação",
        "Beleza",
    ]
    return [CategoryFactory(user=user, name=name, is_default=True) for name in names]


@pytest.fixture
def payment_methods_default(user):
    methods = [
        ("Pix", "zap", "#34d399"),
        ("Débito", "credit-card", "#60a5fa"),
        ("Crédito", "credit-card", "#a78bfa"),
        ("Dinheiro", "banknote", "#4ade80"),
        ("Boleto", "barcode", "#facc15"),
    ]
    return [
        PaymentMethodFactory(
            user=user, name=m[0], icon=m[1], color=m[2], is_default=True
        )
        for m in methods
    ]
