from decimal import Decimal
from typing import Any

from django.db.models import Q, Sum

from apps.transactions.models import (
    Debt,
    RecurringExpense,
    RecurringStatus,
    StatementImport,
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
    def update_later_unpaid(tx: Transaction, fields: dict[str, Any]) -> int:
        """R2: aplica fields às transações posteriores não pagas do mesmo template."""
        later = Q(year__gt=tx.year) | Q(year=tx.year, month__gt=tx.month)
        return Transaction.objects.filter(
            later,
            user_id=tx.user_id,
            recurring_source_id=tx.recurring_source_id,
            is_paid=False,
        ).update(**fields)

    @staticmethod
    def existing_import_keys(user_id: int, keys: list[str]) -> set[str]:
        return set(
            Transaction.objects.filter(
                user_id=user_id, import_key__in=keys
            ).values_list("import_key", flat=True)
        )

    @staticmethod
    def get_by_import_key(user_id: int, key: str) -> Transaction | None:
        return Transaction.objects.filter(user_id=user_id, import_key=key).first()

    @staticmethod
    def fixed_in_month(user_id: int, year: int, month: int) -> list[Transaction]:
        """Fixos (sem vínculo de cartão) do mês, para dedup de importação."""
        return list(
            Transaction.objects.filter(
                user_id=user_id,
                year=year,
                month=month,
                recurring_source__isnull=False,
                recurring_source__card__isnull=True,
            )
        )

    @staticmethod
    def get_by_id(tx_id: int, user_id: int) -> Transaction:
        from apps.common.exceptions import NotFoundError

        try:
            return Transaction.objects.get(id=tx_id, user_id=user_id)
        except Transaction.DoesNotExist:
            raise NotFoundError(f"Transaction {tx_id} not found")

    @staticmethod
    def sum_by_type(user_id: int, year: int, month: int, tx_type: str) -> Decimal:
        qs = Transaction.objects.filter(
            user_id=user_id, year=year, month=month, type=tx_type
        )
        return qs.aggregate(total=Sum("amount"))["total"] or Decimal("0")

    @staticmethod
    def sum_by_kind(
        user_id: int, year: int, month: int, tx_type: str, tx_kind: str
    ) -> Decimal:
        qs = Transaction.objects.filter(
            user_id=user_id, year=year, month=month, type=tx_type, kind=tx_kind
        )
        return qs.aggregate(total=Sum("amount"))["total"] or Decimal("0")

    @staticmethod
    def pending_count(user_id: int, year: int, month: int) -> int:
        return Transaction.objects.filter(
            user_id=user_id, year=year, month=month, is_paid=False
        ).count()

    @staticmethod
    def sum_by_category(user_id: int, year: int, month: int) -> list[dict[str, Any]]:
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
    def create(data: dict[str, Any]) -> RecurringExpense:
        return RecurringExpense.objects.create(**data)

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
    def delete_future_unpaid(recurring: RecurringExpense, year: int, month: int) -> int:
        """Apaga transações não pagas do template em meses após (year, month)."""
        later = Q(year__gt=year) | Q(year=year, month__gt=month)
        return Transaction.objects.filter(
            later, user_id=recurring.user_id, recurring_source=recurring, is_paid=False
        ).delete()[0]

    @staticmethod
    def get_by_id(recurring_id: int, user_id: int) -> RecurringExpense:
        from apps.common.exceptions import NotFoundError

        try:
            return RecurringExpense.objects.get(id=recurring_id, user_id=user_id)
        except RecurringExpense.DoesNotExist:
            raise NotFoundError(f"RecurringExpense {recurring_id} not found")


class DebtRepository:
    @staticmethod
    def create(data: dict[str, Any]) -> Debt:
        return Debt.objects.create(**data)

    @staticmethod
    def get_by_id(debt_id: int, user_id: int) -> Debt:
        from apps.common.exceptions import NotFoundError

        try:
            return Debt.objects.get(id=debt_id, user_id=user_id)
        except Debt.DoesNotExist:
            raise NotFoundError(f"Debt {debt_id} not found")

    @staticmethod
    def delete_card_debt(debt: Debt) -> None:
        debt.installments.filter(is_paid=False).delete()
        debt.installments.filter(is_paid=True).update(debt=None)
        debt.delete()


class StatementImportRepository:
    @staticmethod
    def create(**data: Any) -> StatementImport:
        return StatementImport.objects.create(**data)

    @staticmethod
    def recent(user_id: int, limit: int = 12) -> list[StatementImport]:
        return list(
            StatementImport.objects.filter(user_id=user_id).select_related("card")[
                :limit
            ]
        )
