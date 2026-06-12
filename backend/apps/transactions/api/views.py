from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.dtos import CreateTransactionDTO
from apps.transactions.api.serializers import (
    DebtSerializer,
    GenerateVariableItemSerializer,
    RecurringExpenseSerializer,
    TransactionSerializer,
    _serialize_summary,
)
from apps.transactions.models import Debt, RecurringExpense, Transaction
from apps.transactions.services import (
    MonthSummaryService,
    RecurringExpenseService,
    TransactionService,
)


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = [
        "year",
        "month",
        "type",
        "kind",
        "category",
        "payment_method",
        "is_paid",
    ]
    search_fields = ["description"]

    def get_queryset(self):
        return (
            Transaction.objects.filter(user=self.request.user)
            .select_related("category", "payment_method")
            .order_by("-date", "-id")
        )

    def perform_create(self, serializer):
        data = serializer.validated_data.copy()
        installments = data.pop("installments", None)
        dto = CreateTransactionDTO(
            user_id=self.request.user.id,
            type=data["type"],
            kind=data["kind"],
            description=data["description"],
            amount=data["amount"],
            date=data["date"],
            category_id=data["category"].id if data.get("category") else None,
            payment_method_id=(
                data["payment_method"].id if data.get("payment_method") else None
            ),
            is_paid=data.get("is_paid", False),
            installment_current=data.get("installment_current"),
            installment_total=data.get("installment_total"),
        )
        if installments:
            txs = TransactionService().create_installment_purchase(dto, installments)
            serializer.instance = txs[0]
        else:
            serializer.instance = TransactionService().create(dto)

    def perform_update(self, serializer):
        serializer.validated_data.pop("installments", None)
        tx = serializer.save()
        year, month = TransactionService().resolve_competence(
            self.request.user.id, tx.payment_method_id, tx.date
        )
        if (tx.year, tx.month) != (year, month):
            tx.year = year
            tx.month = month
            tx.save(update_fields=["year", "month"])

    @action(detail=True, methods=["post"], url_path="toggle-paid")
    def toggle_paid(self, request, pk=None):
        tx = TransactionService().toggle_paid(int(pk), request.user.id)
        return Response(TransactionSerializer(tx).data)


class RecurringExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = RecurringExpenseSerializer

    def get_queryset(self):
        return RecurringExpense.objects.filter(user=self.request.user).select_related(
            "category", "payment_method"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DebtViewSet(viewsets.ModelViewSet):
    serializer_class = DebtSerializer

    def get_queryset(self):
        return Debt.objects.filter(user=self.request.user).select_related(
            "payment_method__card"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        from apps.transactions.services import DebtService

        DebtService().delete(instance.id, self.request.user.id)

    @action(detail=True, methods=["post"])
    def advance(self, request, pk=None):
        debt = self.get_object()
        if debt.installment_current < debt.installment_total:
            debt.installment_current += 1
        if debt.installment_current >= debt.installment_total:
            debt.is_settled = True
        debt.save()
        return Response(DebtSerializer(debt).data)


class MonthSummaryView(viewsets.ViewSet):
    def retrieve(self, request, year=None, month=None):
        summary = MonthSummaryService().get_summary(
            request.user.id, int(year), int(month)
        )
        return Response(_serialize_summary(summary))


class GenerateFixedView(viewsets.ViewSet):
    def create(self, request, year=None, month=None):
        result = RecurringExpenseService().generate_for_month(
            request.user.id, int(year), int(month)
        )
        return Response(
            {
                "created": result.created,
                "skipped": result.skipped,
                "completed_templates": result.completed_templates,
                "pending_variables": [
                    {
                        "id": pv.id,
                        "description": pv.description,
                        "suggested_amount": pv.suggested_amount,
                        "category_id": pv.category_id,
                        "payment_method_id": pv.payment_method_id,
                        "due_day": pv.due_day,
                    }
                    for pv in result.pending_variables
                ],
            },
            status=status.HTTP_200_OK,
        )


class GenerateVariablesView(viewsets.ViewSet):
    def create(self, request, year=None, month=None):
        serializer = GenerateVariableItemSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        result = RecurringExpenseService().generate_variables(
            request.user.id,
            int(year),
            int(month),
            serializer.validated_data,
        )
        return Response(
            {"created": result.created, "skipped": result.skipped},
            status=status.HTTP_200_OK,
        )
