from decimal import Decimal

from django.db.models import Sum

from apps.transactions.models import Transaction, TransactionType
from apps.transactions.repositories import without_invoice_when_items


class AnalyticsRepository:
    @staticmethod
    def category_trends_by_year(user_id: int, year: int) -> dict:
        """Returns {(category_name, color): {month: total}} for paid expenses."""
        rows = (
            without_invoice_when_items(
                Transaction.objects.filter(
                    user_id=user_id,
                    year=year,
                    type=TransactionType.EXPENSE,
                    is_paid=True,
                )
            )
            .values("month", "category__name", "category__color")
            .annotate(total=Sum("amount"))
            .order_by("category__name", "month")
        )
        result: dict = {}
        for row in rows:
            key = (row["category__name"], row["category__color"] or "")
            result.setdefault(key, {})[row["month"]] = row["total"] or Decimal("0")
        return result

    @staticmethod
    def top_categories_by_year(
        user_id: int, year: int, limit: int
    ) -> list[tuple[str, str, Decimal]]:
        """Returns [(category_name, color, total)] sorted by total desc."""
        rows = (
            without_invoice_when_items(
                Transaction.objects.filter(
                    user_id=user_id,
                    year=year,
                    type=TransactionType.EXPENSE,
                    is_paid=True,
                )
            )
            .values("category__name", "category__color")
            .annotate(total=Sum("amount"))
            .order_by("-total")[:limit]
        )
        return [
            (
                row["category__name"],
                row["category__color"] or "",
                row["total"] or Decimal("0"),
            )
            for row in rows
        ]
