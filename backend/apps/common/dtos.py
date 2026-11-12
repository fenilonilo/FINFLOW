import datetime
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any


@dataclass
class InstallmentDTO:
    number: int
    due_date: datetime.date
    amount: Decimal
    interest_portion: Decimal
    principal_portion: Decimal
    remaining_balance: Decimal


@dataclass
class FinancialHealthDTO:
    avg_monthly_income: Decimal
    avg_monthly_expense: Decimal
    avg_monthly_invested: Decimal
    avg_balance: Decimal
    fixed_commitment_pct: Decimal
    savings_rate_pct: Decimal
    score: int
    score_label: str


@dataclass
class ImpactDTO:
    baseline: FinancialHealthDTO
    projected: FinancialHealthDTO
    monthly_income_impact_pct: Decimal
    balance_reduction_pct: Decimal
    score_delta: int
    months_negative_balance: int
    opportunity_cost: Decimal
    timeline: list[dict[str, Any]]
    verdict: str
    verdict_message: str


@dataclass
class SimulationResultDTO:
    input: dict[str, Any]
    financed_amount: Decimal
    monthly_payment_first: Decimal
    monthly_payment_last: Decimal
    total_paid: Decimal
    total_interest: Decimal
    effective_cost_pct: Decimal
    schedule: list[InstallmentDTO]
    impact: ImpactDTO


@dataclass
class PendingVariableDTO:
    id: int
    description: str
    suggested_amount: str | None
    category_id: int | None
    payment_method_id: int | None
    due_day: int


@dataclass
class GenerationResultDTO:
    created: int
    skipped: int
    completed_templates: list[int]
    pending_variables: list[PendingVariableDTO] = field(default_factory=list)


@dataclass
class MonthSummaryDTO:
    year: int
    month: int
    total_income: Decimal
    total_expense: Decimal
    total_fixed: Decimal
    total_variable: Decimal
    total_invested: Decimal
    balance: Decimal
    pending_count: int
    investment_goal: Decimal
    by_category: list[dict[str, Any]]
    by_payment_method: list[dict[str, Any]]


@dataclass
class CreateTransactionDTO:
    user_id: int
    type: str
    kind: str
    description: str
    amount: Decimal
    date: datetime.date
    category_id: int | None = None
    payment_method_id: int | None = None
    is_paid: bool = False
    recurring_source_id: int | None = None
    installment_current: int | None = None
    installment_total: int | None = None
    import_key: str | None = None


@dataclass
class AcquisitionSimulateDTO:
    name: str
    total_value: Decimal
    acquisition_type: str
    start_date: datetime.date
    down_payment: Decimal = Decimal("0")
    installments_count: int | None = None
    monthly_interest_rate: Decimal | None = None
    amortization_system: str = "none"
    extra_monthly_cost: Decimal = Decimal("0")
    category_id: int | None = None
    user_id: int | None = None
