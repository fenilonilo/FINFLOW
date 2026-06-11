
import pytest

from apps.common.exceptions import DomainError, NotFoundError, ValidationDomainError
from apps.common.factories import (
    CategoryFactory,
    TransactionFactory,
    UserFactory,
)
from apps.core.models import Category
from apps.core.services import CategoryService, PaymentMethodService

pytestmark = pytest.mark.django_db


def test_category_delete_with_transactions_returns_conflict():
    user = UserFactory()
    category = CategoryFactory(user=user)
    TransactionFactory(user=user, category=category)
    service = CategoryService()

    with pytest.raises(DomainError):
        service.delete(category.id, user.id)

    # Category still exists.
    assert Category.objects.filter(id=category.id).exists()


def test_category_delete_default_is_blocked():
    user = UserFactory()
    category = CategoryFactory(user=user, is_default=True)
    service = CategoryService()

    with pytest.raises(DomainError):
        service.delete(category.id, user.id)


def test_category_delete_without_transactions_succeeds():
    user = UserFactory()
    category = CategoryFactory(user=user, is_default=False)
    service = CategoryService()

    service.delete(category.id, user.id)

    assert not Category.objects.filter(id=category.id).exists()


def test_category_create_rejects_two_level_nesting():
    user = UserFactory()
    root = CategoryFactory(user=user)
    child = CategoryFactory(user=user, parent=root)
    service = CategoryService()

    with pytest.raises(ValidationDomainError):
        service.create(user.id, name="Neta", parent_id=child.id)


def test_category_create_with_valid_parent():
    user = UserFactory()
    root = CategoryFactory(user=user)
    service = CategoryService()

    created = service.create(user.id, name="Sub", parent_id=root.id)

    assert created.parent_id == root.id


def test_category_archive():
    user = UserFactory()
    category = CategoryFactory(user=user)
    service = CategoryService()

    archived = service.archive(category.id, user.id)

    assert archived.is_archived is True


def test_category_get_unknown_raises_not_found():
    user = UserFactory()
    service = CategoryService()

    with pytest.raises(NotFoundError):
        service.archive(999999, user.id)


def test_payment_method_create_and_archive():
    user = UserFactory()
    service = PaymentMethodService()

    pm = service.create(user.id, name="Pix")
    assert pm.name == "Pix"

    archived = service.archive(pm.id, user.id)
    assert archived.is_archived is True
