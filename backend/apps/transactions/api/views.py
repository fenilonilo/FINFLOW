import datetime

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.dtos import CreateTransactionDTO
from apps.transactions.api.serializers import (
    DebtSerializer,
    GenerateVariableItemSerializer,
    RecurringExpenseSerializer,
    StatementImportHistorySerializer,
    StatementImportSerializer,
    TransactionSerializer,
    _serialize_summary,
)
from apps.transactions.models import Debt, RecurringExpense, Transaction
from apps.transactions.repositories import StatementImportRepository
from apps.transactions.services import (
    MonthSummaryService,
    RecurringExpenseService,
    StatementImportService,
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

    def list(self, request, *args, **kwargs):
        year = request.query_params.get("year")
        month = request.query_params.get("month")
        if year and month:
            RecurringExpenseService().ensure_month(
                request.user.id, int(year), int(month)
            )
        return super().list(request, *args, **kwargs)

    def perform_update(self, serializer):
        data = serializer.validated_data
        data.pop("installments", None)
        for rel in ("category", "payment_method"):
            if rel in data:
                obj = data.pop(rel)
                data[f"{rel}_id"] = obj.id if obj else None
        serializer.instance = TransactionService().update(
            serializer.instance.id, self.request.user.id, data
        )

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
        start = serializer.validated_data.get("start_date")
        start = start or datetime.date.today().replace(day=1)
        serializer.save(user=self.request.user, start_date=start)
        RecurringExpenseService().ensure_month(
            self.request.user.id, start.year, start.month
        )

    def perform_destroy(self, instance):
        RecurringExpenseService().delete_template(
            instance.id, self.request.user.id, datetime.date.today()
        )


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
        RecurringExpenseService().ensure_month(request.user.id, int(year), int(month))
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


class StatementImportView(APIView):
    parser_classes = [MultiPartParser]

    @extend_schema(request=StatementImportSerializer, responses={200: dict, 201: dict})
    def post(self, request):
        s = StatementImportSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        result = StatementImportService().import_file(
            request.user.id,
            d["file"].read(),
            d["file"].name,
            d["card_id"],
            d["kind"],
            d.get("year"),
            d.get("month"),
            d.get("categories"),
            d["dry_run"],
        )
        return Response(
            result,
            status=status.HTTP_200_OK if d["dry_run"] else status.HTTP_201_CREATED,
        )


class StatementImportHistoryView(APIView):
    @extend_schema(responses=StatementImportHistorySerializer(many=True))
    def get(self, request):
        rows = StatementImportRepository.recent(request.user.id)
        return Response(StatementImportHistorySerializer(rows, many=True).data)
