from decimal import ROUND_HALF_UP, Decimal

from apps.analytics.repositories import AnalyticsRepository
from apps.common.adapters import NullAIAdvisor
from apps.common.dtos import FinancialHealthDTO
from apps.common.ports import AdviceDTO, AIAdvisorPort
from apps.investments.repositories import InvestmentRepository
from apps.transactions.models import TransactionType
from apps.transactions.repositories import TransactionRepository

SCORE_LABELS = [(80, "Excelente"), (60, "Saudável"), (40, "Atenção"), (0, "Crítico")]


class CategoryTrendsService:
    def __init__(self, repo: AnalyticsRepository | None = None) -> None:
        self._repo = repo or AnalyticsRepository()

    def category_trends(self, user_id: int, year: int) -> list[dict]:
        data = AnalyticsRepository.category_trends_by_year(user_id, year)
        result = []
        for (category_name, color), months_map in data.items():
            months = [
                {
                    "month": m,
                    "year": year,
                    "total": str(months_map[m].quantize(Decimal("0.01"))),
                }
                for m in sorted(months_map)
            ]
            result.append(
                {"category_name": category_name, "color": color, "months": months}
            )
        return result

    def top_categories(self, user_id: int, year: int, limit: int) -> list[dict]:
        rows = AnalyticsRepository.top_categories_by_year(user_id, year, limit)
        return [
            {
                "category_name": name,
                "color": color,
                "total": str(total.quantize(Decimal("0.01"))),
            }
            for name, color, total in rows
        ]


def _label(score: int) -> str:
    for threshold, label in SCORE_LABELS:
        if score >= threshold:
            return label
    return "Crítico"


class FinancialHealthService:
    def __init__(
        self,
        transaction_repo: TransactionRepository | None = None,
        investment_repo: InvestmentRepository | None = None,
        advisor: AIAdvisorPort | None = None,
    ) -> None:
        self._tx = transaction_repo or TransactionRepository()
        self._inv = investment_repo or InvestmentRepository()
        self._advisor: AIAdvisorPort = advisor or NullAIAdvisor()

    def advise(
        self, user_id: int, reference_year: int, reference_month: int
    ) -> AdviceDTO:
        """Delegates spending analysis to the injected AIAdvisorPort.

        Swapping the port implementation (e.g. a real LLM adapter or a
        test fake) requires zero changes to this service.
        """
        health = self.baseline(user_id, reference_year, reference_month)
        return self._advisor.analyze_spending(health)

    def baseline(
        self, user_id: int, reference_year: int, reference_month: int
    ) -> FinancialHealthDTO:
        months_data: list[tuple[Decimal, Decimal, Decimal]] = []
        year, month = reference_year, reference_month
        for _ in range(12):  # look back up to 12 months
            if len(months_data) >= 6:
                break
            month -= 1
            if month == 0:
                month = 12
                year -= 1
            income = self._tx.sum_by_type(
                user_id, year, month, TransactionType.INCOME
            )
            expense = self._tx.sum_by_type(
                user_id, year, month, TransactionType.EXPENSE
            )
            invested = self._inv.sum_by_month(user_id, year, month)
            if income > 0 or expense > 0:
                months_data.append((income, expense, invested))

        if not months_data:
            return FinancialHealthDTO(
                avg_monthly_income=Decimal("0"),
                avg_monthly_expense=Decimal("0"),
                avg_monthly_invested=Decimal("0"),
                avg_balance=Decimal("0"),
                fixed_commitment_pct=Decimal("0"),
                savings_rate_pct=Decimal("0"),
                score=0,
                score_label="Crítico",
            )

        n = len(months_data)
        avg_income = sum((d[0] for d in months_data), Decimal("0")) / n
        avg_expense = sum((d[1] for d in months_data), Decimal("0")) / n
        avg_invested = sum((d[2] for d in months_data), Decimal("0")) / n
        avg_balance = avg_income - avg_expense - avg_invested

        fixed_pct = (
            (avg_expense / avg_income * Decimal("100")).quantize(Decimal("0.01"))
            if avg_income
            else Decimal("0")
        )
        savings_pct = (
            (avg_invested / avg_income * Decimal("100")).quantize(Decimal("0.01"))
            if avg_income
            else Decimal("0")
        )

        months_positive = sum(
            1 for d in months_data if d[0] - d[1] - d[2] > 0
        )

        # score: savings_rate 40% + fixed_commitment_invertido 30%
        #        + regularidade 30%
        s = min(Decimal("40"), savings_pct / Decimal("20") * Decimal("40"))
        f = max(
            Decimal("0"),
            (Decimal("100") - fixed_pct) / Decimal("100") * Decimal("30"),
        )
        r = (Decimal(months_positive) / Decimal(n)) * Decimal("30")
        score = int((s + f + r).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

        return FinancialHealthDTO(
            avg_monthly_income=avg_income.quantize(Decimal("0.01")),
            avg_monthly_expense=avg_expense.quantize(Decimal("0.01")),
            avg_monthly_invested=avg_invested.quantize(Decimal("0.01")),
            avg_balance=avg_balance.quantize(Decimal("0.01")),
            fixed_commitment_pct=fixed_pct,
            savings_rate_pct=savings_pct,
            score=score,
            score_label=_label(score),
        )
