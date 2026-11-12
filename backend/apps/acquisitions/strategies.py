import calendar
import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Protocol

from apps.common.dtos import AcquisitionSimulateDTO, InstallmentDTO


def _clamp_day(year: int, month: int, day: int) -> datetime.date:
    max_day = min(day, calendar.monthrange(year, month)[1])
    max_day = min(max_day, 28)
    return datetime.date(year, month, max_day)


def _due_date(start: datetime.date, k: int) -> datetime.date:
    """Due date of the k-th installment (1-based) counted from start month."""
    months = start.month + k - 1
    year = start.year + (months - 1) // 12
    month = (months - 1) % 12 + 1
    return _clamp_day(year, month, start.day)


def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class AmortizationStrategy(Protocol):
    def build_schedule(self, dto: AcquisitionSimulateDTO) -> list[InstallmentDTO]: ...


class CashStrategy:
    def build_schedule(self, dto: AcquisitionSimulateDTO) -> list[InstallmentDTO]:
        amount = _round2(dto.total_value + dto.extra_monthly_cost)
        return [
            InstallmentDTO(
                number=1,
                due_date=dto.start_date,
                amount=amount,
                interest_portion=Decimal("0"),
                principal_portion=_round2(dto.total_value),
                remaining_balance=Decimal("0"),
            )
        ]


class NoInterestStrategy:
    def build_schedule(self, dto: AcquisitionSimulateDTO) -> list[InstallmentDTO]:
        n = dto.installments_count or 1
        pv = dto.total_value - dto.down_payment
        base = _round2(pv / n)
        schedule: list[InstallmentDTO] = []
        balance = pv
        for k in range(1, n + 1):
            if k == n:
                principal = balance
            else:
                principal = base
            amount = _round2(principal + dto.extra_monthly_cost)
            balance = balance - principal
            schedule.append(
                InstallmentDTO(
                    number=k,
                    due_date=_due_date(dto.start_date, k),
                    amount=amount,
                    interest_portion=Decimal("0"),
                    principal_portion=_round2(principal),
                    remaining_balance=max(Decimal("0"), _round2(balance)),
                )
            )
        return schedule


class PriceStrategy:
    def build_schedule(self, dto: AcquisitionSimulateDTO) -> list[InstallmentDTO]:
        n = dto.installments_count or 1
        pv = dto.total_value - dto.down_payment
        i = (dto.monthly_interest_rate or Decimal("0")) / Decimal("100")
        if i == 0:
            return NoInterestStrategy().build_schedule(dto)
        # PMT = PV * i / (1 - (1+i)^-n)
        factor = (Decimal("1") + i) ** n
        pmt = _round2(pv * i * factor / (factor - Decimal("1")))
        schedule: list[InstallmentDTO] = []
        balance = pv
        for k in range(1, n + 1):
            interest = _round2(balance * i)
            principal = _round2(pmt - interest)
            if k == n:
                principal = balance
                pmt_k = _round2(principal + interest + dto.extra_monthly_cost)
            else:
                pmt_k = _round2(pmt + dto.extra_monthly_cost)
            balance = _round2(balance - principal)
            schedule.append(
                InstallmentDTO(
                    number=k,
                    due_date=_due_date(dto.start_date, k),
                    amount=pmt_k,
                    interest_portion=interest,
                    principal_portion=_round2(principal),
                    remaining_balance=max(Decimal("0"), balance),
                )
            )
        return schedule


class SacStrategy:
    def build_schedule(self, dto: AcquisitionSimulateDTO) -> list[InstallmentDTO]:
        n = dto.installments_count or 1
        pv = dto.total_value - dto.down_payment
        i = (dto.monthly_interest_rate or Decimal("0")) / Decimal("100")
        amort = _round2(pv / n)
        schedule: list[InstallmentDTO] = []
        balance = pv
        for k in range(1, n + 1):
            interest = _round2(balance * i)
            if k == n:
                principal = balance
            else:
                principal = amort
            pmt_k = _round2(principal + interest + dto.extra_monthly_cost)
            balance = _round2(balance - principal)
            schedule.append(
                InstallmentDTO(
                    number=k,
                    due_date=_due_date(dto.start_date, k),
                    amount=pmt_k,
                    interest_portion=interest,
                    principal_portion=_round2(principal),
                    remaining_balance=max(Decimal("0"), balance),
                )
            )
        return schedule


class ConsortiumStrategy:
    """monthly_interest_rate reinterpretado como taxa de administração
    total do plano (%)."""

    def build_schedule(self, dto: AcquisitionSimulateDTO) -> list[InstallmentDTO]:
        n = dto.installments_count or 1
        taxa_adm = (dto.monthly_interest_rate or Decimal("0")) / Decimal("100")
        total = dto.total_value * (Decimal("1") + taxa_adm)
        base = _round2(total / n)
        schedule: list[InstallmentDTO] = []
        balance = total
        for k in range(1, n + 1):
            if k == n:
                principal = balance
            else:
                principal = base
            amount = _round2(principal + dto.extra_monthly_cost)
            balance = balance - principal
            schedule.append(
                InstallmentDTO(
                    number=k,
                    due_date=_due_date(dto.start_date, k),
                    amount=amount,
                    interest_portion=Decimal("0"),
                    principal_portion=_round2(principal),
                    remaining_balance=max(Decimal("0"), _round2(balance)),
                )
            )
        return schedule


class AmortizationFactory:
    @staticmethod
    def for_type(
        acquisition_type: str, amortization_system: str
    ) -> AmortizationStrategy:
        if acquisition_type == "cash":
            return CashStrategy()
        if acquisition_type == "installment":
            return NoInterestStrategy()
        if acquisition_type == "consortium":
            return ConsortiumStrategy()
        # financing
        if amortization_system == "sac":
            return SacStrategy()
        return PriceStrategy()
