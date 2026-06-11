from decimal import Decimal

import pytest

from apps.common.factories import (
    RecurringExpenseFactory,
    UserFactory,
)
from apps.transactions.models import (
    RecurringStatus,
    Transaction,
)
from apps.transactions.services import RecurringExpenseService

pytestmark = pytest.mark.django_db


def test_generate_fixed_is_idempotent():
    user = UserFactory()
    template = RecurringExpenseFactory(user=user, default_amount=Decimal("200.00"))
    service = RecurringExpenseService()

    first = service.generate_for_month(user.id, 2025, 1)
    second = service.generate_for_month(user.id, 2025, 1)

    assert first.created == 1
    assert first.skipped == 0
    assert second.created == 0
    assert second.skipped == 1
    # Only one transaction exists for the template/month.
    count = Transaction.objects.filter(
        recurring_source_id=template.id, year=2025, month=1
    ).count()
    assert count == 1


def test_generate_fixed_skips_paused_templates():
    user = UserFactory()
    RecurringExpenseFactory(user=user, status=RecurringStatus.PAUSED)
    service = RecurringExpenseService()

    result = service.generate_for_month(user.id, 2025, 1)

    assert result.created == 0
    assert Transaction.objects.filter(user=user, year=2025, month=1).count() == 0


def test_generate_fixed_respects_total_occurrences_and_pauses_template():
    user = UserFactory()
    template = RecurringExpenseFactory(
        user=user, total_occurrences=2, generated_count=1
    )
    service = RecurringExpenseService()

    result = service.generate_for_month(user.id, 2025, 1)

    template.refresh_from_db()
    assert result.created == 1
    assert template.generated_count == 2
    assert template.status == RecurringStatus.PAUSED
    assert template.id in result.completed_templates


def test_editing_instance_does_not_change_template():
    user = UserFactory()
    template = RecurringExpenseFactory(user=user, default_amount=Decimal("200.00"))
    service = RecurringExpenseService()
    service.generate_for_month(user.id, 2025, 1)

    instance = Transaction.objects.get(recurring_source_id=template.id)
    instance.amount = Decimal("999.99")
    instance.description = "Editado"
    instance.save()

    template.refresh_from_db()
    assert template.default_amount == Decimal("200.00")
    assert template.description != "Editado"
