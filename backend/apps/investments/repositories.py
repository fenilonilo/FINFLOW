from decimal import Decimal

from django.db.models import Sum

from apps.investments.models import Investment, InvestmentGoal


class InvestmentRepository:
    @staticmethod
    def sum_by_month(user_id: int, year: int, month: int) -> Decimal:
        result = Investment.objects.filter(
            user_id=user_id, year=year, month=month
        ).aggregate(total=Sum("amount"))
        return result["total"] or Decimal("0")

    @staticmethod
    def list_by_year(user_id: int, year: int) -> list[Investment]:
        return list(
            Investment.objects.filter(user_id=user_id, year=year).order_by("date")
        )

    @staticmethod
    def get_goal(user_id: int, year: int, month: int) -> Decimal:
        try:
            goal = InvestmentGoal.objects.get(user_id=user_id, year=year, month=month)
            return goal.target_amount
        except InvestmentGoal.DoesNotExist:
            return Decimal("0")
