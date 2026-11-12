from decimal import ROUND_HALF_UP, Decimal

from apps.acquisitions.strategies import AmortizationFactory
from apps.common.dtos import (
    AcquisitionSimulateDTO,
    FinancialHealthDTO,
    ImpactDTO,
    SimulationResultDTO,
)

OPPORTUNITY_RATE = Decimal("0.009")

SCORE_LABELS = [(80, "Excelente"), (60, "Saudável"), (40, "Atenção"), (0, "Crítico")]


def _label(score: int) -> str:
    for threshold, label in SCORE_LABELS:
        if score >= threshold:
            return label
    return "Crítico"


def _score(
    savings_rate: Decimal,
    fixed_commitment: Decimal,
    months_positive: int,
    total_months: int,
) -> int:
    s = min(Decimal("40"), savings_rate / Decimal("20") * Decimal("40"))
    f = max(
        Decimal("0"),
        (Decimal("100") - fixed_commitment) / Decimal("100") * Decimal("30"),
    )
    regularity = (Decimal(months_positive) / Decimal(max(total_months, 1))) * Decimal(
        "30"
    )
    return int((s + f + regularity).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


class AcquisitionSimulationService:
    def simulate(
        self, dto: AcquisitionSimulateDTO, baseline: FinancialHealthDTO
    ) -> SimulationResultDTO:
        strategy = AmortizationFactory.for_type(
            dto.acquisition_type, dto.amortization_system
        )
        schedule = strategy.build_schedule(dto)

        financed = dto.total_value - dto.down_payment
        total_paid = sum((s.amount for s in schedule), Decimal("0")) + dto.down_payment
        total_interest = sum((s.interest_portion for s in schedule), Decimal("0"))
        effective_cost_pct = (
            (total_interest / financed * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if financed
            else Decimal("0")
        )

        avg_pmt = schedule[0].amount if schedule else Decimal("0")
        income_impact = (
            (avg_pmt / baseline.avg_monthly_income * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if baseline.avg_monthly_income
            else Decimal("100")
        )
        balance_reduction = (
            (avg_pmt / baseline.avg_balance * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if baseline.avg_balance > 0
            else Decimal("100")
        )

        timeline = []
        months_negative = 0
        cumulative = dto.down_payment
        for inst in schedule:
            proj_balance = baseline.avg_balance - inst.amount
            if proj_balance < 0:
                months_negative += 1
            cumulative += inst.amount
            timeline.append(
                {
                    "year": inst.due_date.year,
                    "month": inst.due_date.month,
                    "projected_balance": str(proj_balance.quantize(Decimal("0.01"))),
                    "cumulative_paid": str(cumulative.quantize(Decimal("0.01"))),
                }
            )

        # opportunity cost: FV das parcelas a 0.9%/mês - total pago
        opp = Decimal("0")
        n_total = len(schedule)
        for k, inst in enumerate(schedule):
            periods_remaining = n_total - k
            fv = inst.amount * ((Decimal("1") + OPPORTUNITY_RATE) ** periods_remaining)
            opp += fv
        opp = (opp - total_paid).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        proj_expense = baseline.avg_monthly_expense + avg_pmt
        proj_fixed_pct = (
            (proj_expense / baseline.avg_monthly_income * Decimal("100")).quantize(
                Decimal("0.01")
            )
            if baseline.avg_monthly_income
            else Decimal("100")
        )
        proj_score = _score(
            baseline.savings_rate_pct,
            proj_fixed_pct,
            max(0, len(schedule) - months_negative),
            len(schedule),
        )
        projected = FinancialHealthDTO(
            avg_monthly_income=baseline.avg_monthly_income,
            avg_monthly_expense=proj_expense,
            avg_monthly_invested=baseline.avg_monthly_invested,
            avg_balance=baseline.avg_balance - avg_pmt,
            fixed_commitment_pct=proj_fixed_pct,
            savings_rate_pct=baseline.savings_rate_pct,
            score=proj_score,
            score_label=_label(proj_score),
        )
        score_delta = proj_score - baseline.score

        if months_negative > 0 or income_impact > Decimal("30"):
            verdict = "critical"
        elif income_impact > Decimal("15") or score_delta <= -15:
            verdict = "risky"
        elif income_impact > Decimal("5"):
            verdict = "moderate"
        else:
            verdict = "safe"

        impact_label = {
            "critical": "crítico",
            "risky": "alto",
            "moderate": "moderado",
            "safe": "baixo",
        }[verdict]
        msg = (
            f"Compromete {income_impact}% da sua renda média por "
            f"{len(schedule)} meses e reduz seu saldo médio em "
            f"{balance_reduction}%. Impacto {impact_label}."
        )

        impact = ImpactDTO(
            baseline=baseline,
            projected=projected,
            monthly_income_impact_pct=income_impact,
            balance_reduction_pct=balance_reduction,
            score_delta=score_delta,
            months_negative_balance=months_negative,
            opportunity_cost=opp,
            timeline=timeline,
            verdict=verdict,
            verdict_message=msg,
        )

        return SimulationResultDTO(
            input={"name": dto.name, "total_value": str(dto.total_value)},
            financed_amount=financed,
            monthly_payment_first=schedule[0].amount if schedule else Decimal("0"),
            monthly_payment_last=schedule[-1].amount if schedule else Decimal("0"),
            total_paid=total_paid,
            total_interest=total_interest,
            effective_cost_pct=effective_cost_pct,
            schedule=schedule,
            impact=impact,
        )
