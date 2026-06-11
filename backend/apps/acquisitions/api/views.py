import datetime
import json
from decimal import Decimal

from django.db import transaction as db_transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.acquisitions.api.serializers import (
    AcquisitionSerializer,
    SimulateRequestSerializer,
)
from apps.acquisitions.models import (
    Acquisition,
    AcquisitionInstallment,
    AcquisitionStatus,
)
from apps.acquisitions.services import AcquisitionSimulationService
from apps.analytics.services import FinancialHealthService
from apps.common.dtos import AcquisitionSimulateDTO


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        if hasattr(obj, "isoformat"):
            return obj.isoformat()
        return super().default(obj)


def _health_dict(h):
    return {
        "avg_monthly_income": str(h.avg_monthly_income),
        "avg_monthly_expense": str(h.avg_monthly_expense),
        "avg_monthly_invested": str(h.avg_monthly_invested),
        "avg_balance": str(h.avg_balance),
        "fixed_commitment_pct": str(h.fixed_commitment_pct),
        "savings_rate_pct": str(h.savings_rate_pct),
        "score": h.score,
        "score_label": h.score_label,
    }


def _serialize_result(result):
    return {
        "input": result.input,
        "financed_amount": str(result.financed_amount),
        "monthly_payment_first": str(result.monthly_payment_first),
        "monthly_payment_last": str(result.monthly_payment_last),
        "total_paid": str(result.total_paid),
        "total_interest": str(result.total_interest),
        "effective_cost_pct": str(result.effective_cost_pct),
        "schedule": [
            {
                "number": s.number,
                "due_date": str(s.due_date),
                "amount": str(s.amount),
                "interest_portion": str(s.interest_portion),
                "principal_portion": str(s.principal_portion),
                "remaining_balance": str(s.remaining_balance),
            }
            for s in result.schedule
        ],
        "impact": {
            "baseline": _health_dict(result.impact.baseline),
            "projected": _health_dict(result.impact.projected),
            "monthly_income_impact_pct": str(result.impact.monthly_income_impact_pct),
            "balance_reduction_pct": str(result.impact.balance_reduction_pct),
            "score_delta": result.impact.score_delta,
            "months_negative_balance": result.impact.months_negative_balance,
            "opportunity_cost": str(result.impact.opportunity_cost),
            "timeline": result.impact.timeline,
            "verdict": result.impact.verdict,
            "verdict_message": result.impact.verdict_message,
        },
    }


class AcquisitionViewSet(viewsets.ModelViewSet):
    serializer_class = AcquisitionSerializer

    def get_queryset(self):
        return Acquisition.objects.filter(user=self.request.user).prefetch_related(
            "installments"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["post"])
    def simulate(self, request):
        serializer = SimulateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        dto = AcquisitionSimulateDTO(
            name=data["name"],
            total_value=data["total_value"],
            acquisition_type=data["acquisition_type"],
            down_payment=data.get("down_payment", Decimal("0")),
            installments_count=data.get("installments_count"),
            monthly_interest_rate=data.get("monthly_interest_rate"),
            amortization_system=data.get("amortization_system", "none"),
            extra_monthly_cost=data.get("extra_monthly_cost", Decimal("0")),
            start_date=data["start_date"],
            user_id=request.user.id,
        )

        today = datetime.date.today()
        baseline = FinancialHealthService().baseline(
            request.user.id, today.year, today.month
        )
        result = AcquisitionSimulationService().simulate(dto, baseline)
        return Response(_serialize_result(result))

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        acquisition = self.get_object()
        if acquisition.status != AcquisitionStatus.SIMULATION:
            return Response(
                {"detail": "Aquisição não está em status de simulação."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = datetime.date.today()
        baseline = FinancialHealthService().baseline(
            request.user.id, today.year, today.month
        )
        dto = AcquisitionSimulateDTO(
            name=acquisition.name,
            total_value=acquisition.total_value,
            acquisition_type=acquisition.acquisition_type,
            down_payment=acquisition.down_payment,
            installments_count=acquisition.installments_count,
            monthly_interest_rate=acquisition.monthly_interest_rate,
            amortization_system=acquisition.amortization_system,
            extra_monthly_cost=acquisition.extra_monthly_cost,
            start_date=acquisition.start_date,
            user_id=request.user.id,
        )

        result = AcquisitionSimulationService().simulate(dto, baseline)

        with db_transaction.atomic():
            AcquisitionInstallment.objects.filter(acquisition=acquisition).delete()
            for inst in result.schedule:
                AcquisitionInstallment.objects.create(
                    acquisition=acquisition,
                    number=inst.number,
                    due_date=inst.due_date,
                    amount=inst.amount,
                    interest_portion=inst.interest_portion,
                    principal_portion=inst.principal_portion,
                    remaining_balance=inst.remaining_balance,
                )

            from apps.core.models import Category
            from apps.transactions.models import (
                RecurringExpense,
                RecurringStatus,
                Transaction,
                TransactionKind,
                TransactionType,
            )

            category = acquisition.category
            if not category:
                category = Category.objects.filter(
                    user=request.user, name="Outros"
                ).first()

            avg_pmt = result.monthly_payment_first
            n = acquisition.installments_count or 1
            due_day = min(acquisition.start_date.day, 28)

            recurring = RecurringExpense.objects.create(
                user=request.user,
                category=category,
                description=acquisition.name,
                default_amount=avg_pmt,
                due_day=due_day,
                status=RecurringStatus.ACTIVE,
                total_occurrences=n,
                acquisition=acquisition,
            )

            if acquisition.down_payment > 0:
                Transaction.objects.create(
                    user=request.user,
                    type=TransactionType.EXPENSE,
                    kind=TransactionKind.VARIABLE,
                    category=category,
                    description=f"{acquisition.name} — Entrada",
                    amount=acquisition.down_payment,
                    date=acquisition.start_date,
                    year=acquisition.start_date.year,
                    month=acquisition.start_date.month,
                    is_paid=True,
                )

            acquisition.status = AcquisitionStatus.ACTIVE
            acquisition.recurring_expense = recurring
            acquisition.result_snapshot = json.loads(
                json.dumps(_serialize_result(result), cls=DecimalEncoder)
            )
            acquisition.save()

        return Response(AcquisitionSerializer(acquisition).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        from apps.transactions.models import RecurringStatus

        acquisition = self.get_object()
        acquisition.status = AcquisitionStatus.CANCELLED
        if acquisition.recurring_expense:
            acquisition.recurring_expense.status = RecurringStatus.PAUSED
            acquisition.recurring_expense.save()
        acquisition.save()
        return Response(AcquisitionSerializer(acquisition).data)
