from decimal import Decimal
from typing import Any

from django.db.models import Sum

from apps.transactions.models import (
    RecurringExpense,
    RecurringStatus,
    Transaction,
    TransactionType,
)


class TransactionRepository:
    @staticmethod
    def list_by_month(
        user_id: int, year: int, month: int, **filters: Any
    ) -> list[Transaction]:
        qs = Transaction.objects.filter(user_id=user_id, year=year, month=month)
        if "type" in filters:
            qs = qs.filter(type=filters["type"])
        if "kind" in filters:
            qs = qs.filter(kind=filters["kind"])
        if "category_id" in filters:
            qs = qs.filter(category_id=filters["category_id"])
        if "is_paid" in filters:
            qs = qs.filter(is_paid=filters["is_paid"])
        return list(qs.select_related("category", "payment_method"))

    @staticmethod
    def create(data: dict[str, Any]) -> Transaction:
        return Transaction.objects.create(**data)

    @staticmethod
    def get_by_id(tx_id: int, user_id: int) -> Transaction:
        from apps.common.exceptions import NotFoundError

        try:
            return Transaction.objects.get(id=tx_id, user_id=user_id)
        except Transaction.DoesNotExist:
            raise NotFoundError(f"Transaction {tx_id} not found")

    @staticmethod
    def sum_by_type(user_id: int, year: int, month: int, tx_type: str) -> Decimal:
        result = Transaction.objects.filter(
            user_id=user_id, year=year, month=month, type=tx_type
        ).aggregate(total=Sum("amount"))
        return result["total"] or Decimal("0")

    @staticmethod
    def sum_by_kind(
        user_id: int, year: int, month: int, tx_type: str, tx_kind: str
    ) -> Decimal:
        result = Transaction.objects.filter(
            user_id=user_id, year=year, month=month, type=tx_type, kind=tx_kind
        ).aggregate(total=Sum("amount"))
        return result["total"] or Decimal("0")

    @staticmethod
    def pending_count(user_id: int, year: int, month: int) -> int:
        return Transaction.objects.filter(
            user_id=user_id, year=year, month=month, is_paid=False
        ).count()

    @staticmethod
    def sum_by_category(
        user_id: int, year: int, month: int
    ) -> list[dict[str, Any]]:
        return list(
            Transaction.objects.filter(
                user_id=user_id,
                year=year,
                month=month,
                type=TransactionType.EXPENSE,
            )
            .values("category_id", "category__name", "category__color")
            .annotate(total=Sum("amount"))
        )

    @staticmethod
    def sum_by_payment_method(
        user_id: int, year: int, month: int
    ) -> list[dict[str, Any]]:
        return list(
            Transaction.objects.filter(
                user_id=user_id,
                year=year,
                month=month,
                type=TransactionType.EXPENSE,
            )
            .values("payment_method_id", "payment_method__name")
            .annotate(total=Sum("amount"))
        )


class RecurringExpenseRepository:
    @staticmethod
    def list_active(user_id: int) -> list[RecurringExpense]:
        return list(
            RecurringExpense.objects.filter(
                user_id=user_id, status=RecurringStatus.ACTIVE
            )
        )

    @staticmethod
    def exists_transaction_for_month(
        recurring_id: int, user_id: int, year: int, month: int
    ) -> bool:
        return Transaction.objects.filter(
            recurring_source_id=recurring_id,
            user_id=user_id,
            year=year,
            month=month,
        ).exists()

    @staticmethod
    def get_by_id(recurring_id: int, user_id: int) -> RecurringExpense:
        from apps.common.exceptions import NotFoundError

        try:
            return RecurringExpense.objects.get(id=recurring_id, user_id=user_id)
        except RecurringExpense.DoesNotExist:
            raise NotFoundError(f"RecurringExpense {recurring_id} not found")
