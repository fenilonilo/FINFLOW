import datetime
from decimal import Decimal

from apps.acquisitions.services import AcquisitionSimulationService
from apps.acquisitions.strategies import (
    AmortizationFactory,
    CashStrategy,
    ConsortiumStrategy,
    NoInterestStrategy,
    PriceStrategy,
    SacStrategy,
)
from apps.common.dtos import AcquisitionSimulateDTO, FinancialHealthDTO


def _financing_dto(**overrides) -> AcquisitionSimulateDTO:
    base = {
        "name": "Carro",
        "total_value": Decimal("8000"),
        "acquisition_type": "financing",
        "start_date": datetime.date(2026, 7, 15),
        "down_payment": Decimal("0"),
        "installments_count": 24,
        "monthly_interest_rate": Decimal("1.99"),
        "amortization_system": "price",
    }
    base.update(overrides)
    return AcquisitionSimulateDTO(**base)


def test_price_schedule_total_equals_pv_plus_interest():
    dto = _financing_dto()
    schedule = PriceStrategy().build_schedule(dto)

    assert len(schedule) == 24
    # PV=8000, n=24, i=1.99% a.m. -> PMT mathematically = 422.49
    # (plano sec. 8 cita "~422.94"; o valor correto pela fórmula PRICE é
    # 422.49 e os juros totais ficam ~2140, dentro do intervalo esperado).
    assert schedule[0].amount == Decimal("422.49")
    total_principal = sum(s.principal_portion for s in schedule)
    total_interest = sum(s.interest_portion for s in schedule)
    total_paid = sum(s.amount for s in schedule)
    # Principal closes exactly to PV
    assert total_principal == Decimal("8000")
    # Balance closes to ZERO exactly on last installment
    assert schedule[-1].remaining_balance == Decimal("0")
    # total = pv + interest
    assert total_paid == total_principal + total_interest
    assert Decimal("2130") <= total_interest <= Decimal("2160")


def test_sac_installments_are_decreasing():
    dto = _financing_dto(amortization_system="sac")
    schedule = SacStrategy().build_schedule(dto)

    assert len(schedule) == 24
    amounts = [s.amount for s in schedule]
    # strictly decreasing (except possibly last rounding adjustment)
    for i in range(len(amounts) - 2):
        assert amounts[i] > amounts[i + 1]
    # constant amortization on non-final installments
    assert schedule[0].principal_portion == schedule[1].principal_portion
    assert schedule[-1].remaining_balance == Decimal("0")
    total_principal = sum(s.principal_portion for s in schedule)
    assert total_principal == Decimal("8000")


def test_zero_interest_installment_divides_evenly_with_rounding_adjustment():
    dto = AcquisitionSimulateDTO(
        name="Geladeira",
        total_value=Decimal("1000"),
        acquisition_type="installment",
        start_date=datetime.date(2026, 1, 10),
        installments_count=3,
        amortization_system="none",
    )
    schedule = NoInterestStrategy().build_schedule(dto)

    assert len(schedule) == 3
    # 1000 / 3 = 333.33, last absorbs the cent -> 333.34
    assert schedule[0].amount == Decimal("333.33")
    assert schedule[1].amount == Decimal("333.33")
    assert schedule[2].amount == Decimal("333.34")
    total = sum(s.amount for s in schedule)
    assert total == Decimal("1000.00")
    assert schedule[-1].remaining_balance == Decimal("0")
    assert all(s.interest_portion == Decimal("0") for s in schedule)


def test_cash_acquisition_generates_single_variable_expense_plan():
    dto = AcquisitionSimulateDTO(
        name="Notebook",
        total_value=Decimal("4500"),
        acquisition_type="cash",
        start_date=datetime.date(2026, 3, 20),
    )
    schedule = CashStrategy().build_schedule(dto)

    assert len(schedule) == 1
    assert schedule[0].number == 1
    assert schedule[0].amount == Decimal("4500.00")
    assert schedule[0].interest_portion == Decimal("0")
    assert schedule[0].remaining_balance == Decimal("0")
    # factory routes cash -> CashStrategy
    strategy = AmortizationFactory.for_type("cash", "none")
    assert isinstance(strategy, CashStrategy)


def test_consortium_distributes_admin_fee_across_installments():
    dto = AcquisitionSimulateDTO(
        name="Imóvel",
        total_value=Decimal("12000"),
        acquisition_type="consortium",
        start_date=datetime.date(2026, 1, 10),
        installments_count=12,
        monthly_interest_rate=Decimal("20"),  # 20% taxa admin total
    )
    schedule = ConsortiumStrategy().build_schedule(dto)

    assert len(schedule) == 12
    # total = 12000 * 1.20 = 14400
    total = sum(s.amount for s in schedule)
    assert total == Decimal("14400.00")
    assert all(s.interest_portion == Decimal("0") for s in schedule)
    assert schedule[-1].remaining_balance == Decimal("0")
    # factory routing
    assert isinstance(
        AmortizationFactory.for_type("consortium", "none"), ConsortiumStrategy
    )


def test_factory_routes_financing_to_price_and_sac():
    assert isinstance(AmortizationFactory.for_type("financing", "price"), PriceStrategy)
    assert isinstance(AmortizationFactory.for_type("financing", "sac"), SacStrategy)
    assert isinstance(
        AmortizationFactory.for_type("installment", "none"), NoInterestStrategy
    )


def test_price_with_zero_rate_falls_back_to_no_interest():
    dto = _financing_dto(monthly_interest_rate=Decimal("0"))
    schedule = PriceStrategy().build_schedule(dto)

    assert all(s.interest_portion == Decimal("0") for s in schedule)
    assert sum(s.principal_portion for s in schedule) == Decimal("8000")


def test_down_payment_and_extra_cost_and_day_clamp():
    dto = AcquisitionSimulateDTO(
        name="Moto",
        total_value=Decimal("10000"),
        acquisition_type="financing",
        start_date=datetime.date(2026, 1, 31),  # day 31 -> clamps to 28
        down_payment=Decimal("2000"),
        installments_count=6,
        monthly_interest_rate=Decimal("2"),
        amortization_system="price",
        extra_monthly_cost=Decimal("15"),
    )
    schedule = PriceStrategy().build_schedule(dto)

    # financed PV reduced by down payment
    assert sum(s.principal_portion for s in schedule) == Decimal("8000")
    # extra monthly cost added on top of every installment
    first = schedule[0]
    assert first.amount > first.interest_portion + first.principal_portion
    # day clamped to <= 28 even though start day is 31
    assert all(s.due_date.day <= 28 for s in schedule)


def test_simulation_verdict_safe_for_low_impact():
    baseline = FinancialHealthDTO(
        avg_monthly_income=Decimal("50000"),
        avg_monthly_expense=Decimal("10000"),
        avg_monthly_invested=Decimal("5000"),
        avg_balance=Decimal("35000"),
        fixed_commitment_pct=Decimal("20.00"),
        savings_rate_pct=Decimal("10.00"),
        score=70,
        score_label="Saudável",
    )
    dto = _financing_dto()
    result = AcquisitionSimulationService().simulate(dto, baseline)

    assert result.impact.verdict == "safe"
    assert result.impact.months_negative_balance == 0
    assert result.financed_amount == Decimal("8000")
    assert result.monthly_payment_first == Decimal("422.49")


def test_cash_simulation_safe_and_single_installment():
    baseline = FinancialHealthDTO(
        avg_monthly_income=Decimal("20000"),
        avg_monthly_expense=Decimal("5000"),
        avg_monthly_invested=Decimal("2000"),
        avg_balance=Decimal("13000"),
        fixed_commitment_pct=Decimal("25.00"),
        savings_rate_pct=Decimal("10.00"),
        score=75,
        score_label="Saudável",
    )
    dto = AcquisitionSimulateDTO(
        name="TV",
        total_value=Decimal("3000"),
        acquisition_type="cash",
        start_date=datetime.date(2026, 5, 10),
    )
    result = AcquisitionSimulationService().simulate(dto, baseline)

    assert len(result.schedule) == 1
    assert result.total_interest == Decimal("0")
    assert result.effective_cost_pct == Decimal("0.00")


def test_simulation_verdict_risky_for_high_income_impact():
    # income impact between 15% and 30%, balance stays positive
    baseline = FinancialHealthDTO(
        avg_monthly_income=Decimal("2000"),  # 422/2000 = 21.1%
        avg_monthly_expense=Decimal("800"),
        avg_monthly_invested=Decimal("200"),
        avg_balance=Decimal("5000"),
        fixed_commitment_pct=Decimal("40.00"),
        savings_rate_pct=Decimal("10.00"),
        score=60,
        score_label="Saudável",
    )
    dto = _financing_dto()
    result = AcquisitionSimulationService().simulate(dto, baseline)

    assert result.impact.months_negative_balance == 0
    assert result.impact.verdict == "risky"


def test_simulation_verdict_moderate_for_mid_income_impact():
    # income impact between 5% and 15%, balance positive
    baseline = FinancialHealthDTO(
        avg_monthly_income=Decimal("5000"),  # 422/5000 = 8.4%
        avg_monthly_expense=Decimal("2000"),
        avg_monthly_invested=Decimal("500"),
        avg_balance=Decimal("8000"),
        fixed_commitment_pct=Decimal("40.00"),
        savings_rate_pct=Decimal("10.00"),
        score=65,
        score_label="Saudável",
    )
    dto = _financing_dto()
    result = AcquisitionSimulationService().simulate(dto, baseline)

    assert result.impact.months_negative_balance == 0
    assert result.impact.verdict == "moderate"
    assert result.impact.opportunity_cost != Decimal("0")
    assert len(result.impact.timeline) == 24


def test_simulation_verdict_critical_when_balance_goes_negative():
    # Low average balance so any installment drives balance negative.
    baseline = FinancialHealthDTO(
        avg_monthly_income=Decimal("3000"),
        avg_monthly_expense=Decimal("2900"),
        avg_monthly_invested=Decimal("0"),
        avg_balance=Decimal("100"),
        fixed_commitment_pct=Decimal("96.67"),
        savings_rate_pct=Decimal("0"),
        score=20,
        score_label="Crítico",
    )
    dto = _financing_dto()
    result = AcquisitionSimulationService().simulate(dto, baseline)

    assert result.impact.months_negative_balance > 0
    assert result.impact.verdict == "critical"
