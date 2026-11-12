import datetime

from django.db.models import Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics.services import CategoryTrendsService, FinancialHealthService
from apps.investments.repositories import InvestmentRepository
from apps.transactions.models import Transaction, TransactionType
from apps.transactions.repositories import TransactionRepository
from apps.transactions.services import RecurringExpenseService


class YearlyAnalyticsView(APIView):
    def get(self, request):
        year = int(request.query_params.get("year", datetime.date.today().year))
        months = []
        today = datetime.date.today()
        for month in range(1, 13):
            if (year, month) <= (today.year, today.month):
                RecurringExpenseService().ensure_month(request.user.id, year, month)
            income = TransactionRepository.sum_by_type(
                request.user.id, year, month, TransactionType.INCOME
            )
            expense = TransactionRepository.sum_by_type(
                request.user.id, year, month, TransactionType.EXPENSE
            )
            invested = InvestmentRepository.sum_by_month(request.user.id, year, month)
            months.append(
                {
                    "month": month,
                    "total_income": str(income),
                    "total_expense": str(expense),
                    "total_invested": str(invested),
                    "balance": str(income - expense - invested),
                }
            )
        return Response({"year": year, "months": months})


class HealthScoreView(APIView):
    def get(self, request):
        year = int(request.query_params.get("year", datetime.date.today().year))
        month = int(request.query_params.get("month", datetime.date.today().month))
        RecurringExpenseService().ensure_month(request.user.id, year, month)
        health = FinancialHealthService().baseline(request.user.id, year, month)
        return Response(
            {
                "avg_monthly_income": str(health.avg_monthly_income),
                "avg_monthly_expense": str(health.avg_monthly_expense),
                "avg_monthly_invested": str(health.avg_monthly_invested),
                "avg_balance": str(health.avg_balance),
                "fixed_commitment_pct": str(health.fixed_commitment_pct),
                "savings_rate_pct": str(health.savings_rate_pct),
                "score": health.score,
                "score_label": health.score_label,
            }
        )


class HeatmapView(APIView):
    def get(self, request):
        year = int(request.query_params.get("year", datetime.date.today().year))
        data = (
            Transaction.objects.filter(
                user=request.user,
                year=year,
                type=TransactionType.EXPENSE,
            )
            .values("date")
            .annotate(total=Sum("amount"))
            .order_by("date")
        )
        return Response(
            [{"date": str(d["date"]), "total": str(d["total"])} for d in data]
        )


class CategoryTrendsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year = int(request.query_params.get("year", datetime.date.today().year))
        data = CategoryTrendsService().category_trends(request.user.id, year)
        return Response(data)


class TopCategoriesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year = int(request.query_params.get("year", datetime.date.today().year))
        limit = int(request.query_params.get("limit", 8))
        data = CategoryTrendsService().top_categories(request.user.id, year, limit)
        return Response(data)
