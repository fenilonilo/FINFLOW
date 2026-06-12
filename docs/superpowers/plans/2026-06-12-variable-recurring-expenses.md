# Variable Recurring Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow recurring expenses to be flagged as variable-amount so that clicking "Gerar este mês" prompts the user to enter the real value for that month instead of copying a fixed default.

**Architecture:** Add `is_variable` boolean + nullable `default_amount` to `RecurringExpense`. `generate_for_month` skips variable templates and returns them as `pending_variables`. A new `POST /months/{year}/{month}/generate-variables/` endpoint accepts user-provided amounts and creates those transactions. Frontend opens a fill-in modal when `pending_variables` is non-empty.

**Tech Stack:** Python 3.12 + Django 5 + DRF + factory_boy (backend); React 18 + TypeScript + react-hook-form + TanStack Query (frontend)

---

## Files

| Action | Path |
|--------|------|
| Modify | `backend/apps/common/dtos.py` |
| Modify | `backend/apps/transactions/models.py` |
| Create | `backend/apps/transactions/migrations/0002_recurringexpense_is_variable.py` |
| Modify | `backend/apps/common/factories.py` |
| Modify | `backend/apps/transactions/services.py` |
| Modify | `backend/apps/transactions/api/serializers.py` |
| Modify | `backend/apps/transactions/api/views.py` |
| Modify | `backend/apps/transactions/api/urls.py` |
| Modify | `backend/apps/transactions/tests/unit/test_recurring.py` |
| Modify | `frontend/src/types/api.ts` |
| Modify | `frontend/src/pages/RecurringExpenses.tsx` |

---

## Task 1: DTOs — add PendingVariableDTO and update GenerationResultDTO

**Files:**
- Modify: `backend/apps/common/dtos.py`

- [ ] **Step 1: Add `PendingVariableDTO` and update `GenerationResultDTO`**

Replace the current `GenerationResultDTO` dataclass and add the new one in `backend/apps/common/dtos.py`:

```python
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
    pending_variables: list["PendingVariableDTO"]
```

The full file after the edit:

```python
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
```

- [ ] **Step 2: Verify no import errors**

```bash
cd backend && uv run python -c "from apps.common.dtos import GenerationResultDTO, PendingVariableDTO; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/apps/common/dtos.py
git commit -m "feat: add PendingVariableDTO and pending_variables to GenerationResultDTO"
```

---

## Task 2: Model — add is_variable flag and make default_amount nullable

**Files:**
- Modify: `backend/apps/transactions/models.py`
- Create: `backend/apps/transactions/migrations/0002_recurringexpense_is_variable.py`
- Modify: `backend/apps/common/factories.py`

- [ ] **Step 1: Update the model**

In `backend/apps/transactions/models.py`, update `RecurringExpense`:

```python
class RecurringExpense(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="recurring_expenses"
    )
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, null=True, blank=True
    )
    payment_method = models.ForeignKey(
        PaymentMethod, on_delete=models.PROTECT, null=True, blank=True
    )
    description = models.CharField(max_length=100)
    is_variable = models.BooleanField(default=False)
    default_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    due_day = models.PositiveSmallIntegerField()  # 1-28
    status = models.CharField(
        max_length=10,
        choices=RecurringStatus.choices,
        default=RecurringStatus.ACTIVE,
    )
    total_occurrences = models.PositiveSmallIntegerField(null=True, blank=True)
    generated_count = models.PositiveSmallIntegerField(default=0)
    acquisition = models.ForeignKey(
        "acquisitions.Acquisition",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="recurring_expenses",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transactions_recurringexpense"

    def __str__(self) -> str:
        return self.description
```

- [ ] **Step 2: Generate migration**

```bash
cd backend && uv run python manage.py makemigrations transactions --name="recurringexpense_is_variable"
```

Expected output: `Migrations for 'transactions': apps/transactions/migrations/0002_recurringexpense_is_variable.py`

- [ ] **Step 3: Verify migration content**

Open `backend/apps/transactions/migrations/0002_recurringexpense_is_variable.py` and confirm it contains:
- `AddField` for `is_variable` with `default=False`
- `AlterField` for `default_amount` with `null=True`

- [ ] **Step 4: Apply migration**

```bash
cd backend && uv run python manage.py migrate
```

Expected: applies cleanly, no errors.

- [ ] **Step 5: Update RecurringExpenseFactory**

In `backend/apps/common/factories.py`, add `is_variable = False` to `RecurringExpenseFactory`:

```python
class RecurringExpenseFactory(DjangoModelFactory):
    class Meta:
        model = RecurringExpense

    user = factory.SubFactory(UserFactory)
    category = factory.SubFactory(
        CategoryFactory, user=factory.SelfAttribute("..user")
    )
    payment_method = factory.SubFactory(
        PaymentMethodFactory, user=factory.SelfAttribute("..user")
    )
    description = factory.Sequence(lambda n: f"Gasto Fixo {n}")
    is_variable = False
    default_amount = Decimal("100.00")
    due_day = 10
    status = RecurringStatus.ACTIVE
    total_occurrences = None
    generated_count = 0
```

- [ ] **Step 6: Verify existing tests still pass**

```bash
cd backend && uv run pytest apps/transactions/tests/unit/test_recurring.py -v
```

Expected: all 4 existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/apps/transactions/models.py \
        backend/apps/transactions/migrations/0002_recurringexpense_is_variable.py \
        backend/apps/common/factories.py
git commit -m "feat: add is_variable flag and nullable default_amount to RecurringExpense"
```

---

## Task 3: Service — modify generate_for_month to skip variable templates

**Files:**
- Modify: `backend/apps/transactions/services.py`
- Modify: `backend/apps/transactions/tests/unit/test_recurring.py`

- [ ] **Step 1: Write failing tests**

First, add `import datetime` to the imports at the top of `backend/apps/transactions/tests/unit/test_recurring.py` (after the existing imports):

```python
import datetime
```

Then add the following tests to the same file:

```python
def test_generate_fixed_skips_variable_and_returns_pending():
    user = UserFactory()
    RecurringExpenseFactory(
        user=user,
        description="Luz",
        is_variable=True,
        default_amount=Decimal("180.00"),
        due_day=10,
    )
    service = RecurringExpenseService()

    result = service.generate_for_month(user.id, 2025, 1)

    assert result.created == 0
    assert result.skipped == 0
    assert len(result.pending_variables) == 1
    pv = result.pending_variables[0]
    assert pv.description == "Luz"
    assert pv.suggested_amount == "180.00"
    assert pv.due_day == 10
    assert Transaction.objects.filter(user=user, year=2025, month=1).count() == 0


def test_generate_fixed_skips_already_generated_variable():
    user = UserFactory()
    template = RecurringExpenseFactory(
        user=user, is_variable=True, default_amount=None
    )
    service = RecurringExpenseService()

    # Simulate variable already generated by creating a transaction manually
    from apps.transactions.models import TransactionKind, TransactionType
    Transaction.objects.create(
        user=user,
        type=TransactionType.EXPENSE,
        kind=TransactionKind.FIXED,
        description=template.description,
        amount=Decimal("50.00"),
        date=datetime.date(2025, 1, 10),
        year=2025,
        month=1,
        recurring_source=template,
    )

    result = service.generate_for_month(user.id, 2025, 1)

    assert result.skipped == 1
    assert len(result.pending_variables) == 0


def test_generate_fixed_variable_with_no_default_amount_returns_none_suggested():
    user = UserFactory()
    RecurringExpenseFactory(
        user=user, is_variable=True, default_amount=None, description="Telefone"
    )
    service = RecurringExpenseService()

    result = service.generate_for_month(user.id, 2025, 1)

    assert len(result.pending_variables) == 1
    assert result.pending_variables[0].suggested_amount is None
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && uv run pytest apps/transactions/tests/unit/test_recurring.py \
  -k "test_generate_fixed_skips_variable_and_returns_pending or test_generate_fixed_skips_already_generated_variable or test_generate_fixed_variable_with_no_default_amount" \
  -v
```

Expected: 3 FAILED (AttributeError or AssertionError).

- [ ] **Step 3: Update generate_for_month in services.py**

Replace the `generate_for_month` method inside `RecurringExpenseService` in `backend/apps/transactions/services.py`:

```python
def generate_for_month(
    self, user_id: int, year: int, month: int
) -> GenerationResultDTO:
    from apps.common.dtos import PendingVariableDTO

    templates = self._recurring.list_active(user_id)
    created = 0
    skipped = 0
    completed: list[int] = []
    pending_variables: list[PendingVariableDTO] = []

    for template in templates:
        if self._recurring.exists_transaction_for_month(
            template.id, user_id, year, month
        ):
            skipped += 1
            continue

        if template.is_variable:
            pending_variables.append(
                PendingVariableDTO(
                    id=template.id,
                    description=template.description,
                    suggested_amount=(
                        str(template.default_amount)
                        if template.default_amount is not None
                        else None
                    ),
                    category_id=template.category_id,
                    payment_method_id=template.payment_method_id,
                    due_day=template.due_day,
                )
            )
            continue

        day = min(template.due_day, calendar.monthrange(year, month)[1])
        date = datetime.date(year, month, day)

        self._tx.create(
            {
                "user_id": user_id,
                "type": TransactionType.EXPENSE,
                "kind": TransactionKind.FIXED,
                "category_id": template.category_id,
                "payment_method_id": template.payment_method_id,
                "description": template.description,
                "amount": template.default_amount,
                "date": date,
                "year": year,
                "month": month,
                "is_paid": False,
                "recurring_source_id": template.id,
            }
        )
        created += 1

        template.generated_count += 1
        if (
            template.total_occurrences
            and template.generated_count >= template.total_occurrences
        ):
            template.status = RecurringStatus.PAUSED
            completed.append(template.id)
        template.save()

    return GenerationResultDTO(
        created=created,
        skipped=skipped,
        completed_templates=completed,
        pending_variables=pending_variables,
    )
```

Also update the import at the top of `services.py` — `GenerationResultDTO` is already imported, but the `PendingVariableDTO` import is done inline inside the method (lazy import to avoid circular issues); this is acceptable.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && uv run pytest apps/transactions/tests/unit/test_recurring.py -v
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/transactions/services.py \
        backend/apps/transactions/tests/unit/test_recurring.py
git commit -m "feat: generate_for_month skips variable templates and returns pending_variables"
```

---

## Task 4: Service — add generate_variables method

**Files:**
- Modify: `backend/apps/transactions/services.py`
- Modify: `backend/apps/transactions/tests/unit/test_recurring.py`

- [ ] **Step 1: Write failing tests**

Add to `backend/apps/transactions/tests/unit/test_recurring.py`:

```python
def test_generate_variables_creates_transactions_with_provided_amounts():
    user = UserFactory()
    template = RecurringExpenseFactory(
        user=user, is_variable=True, default_amount=None, due_day=10
    )
    service = RecurringExpenseService()

    result = service.generate_variables(
        user.id, 2025, 1, [{"recurring_id": template.id, "amount": Decimal("187.50")}]
    )

    assert result.created == 1
    assert result.skipped == 0
    tx = Transaction.objects.get(recurring_source=template, year=2025, month=1)
    assert tx.amount == Decimal("187.50")
    assert tx.kind == "fixed"
    template.refresh_from_db()
    assert template.generated_count == 1


def test_generate_variables_is_idempotent():
    user = UserFactory()
    template = RecurringExpenseFactory(user=user, is_variable=True, default_amount=None)
    service = RecurringExpenseService()

    service.generate_variables(
        user.id, 2025, 1, [{"recurring_id": template.id, "amount": Decimal("50.00")}]
    )
    result = service.generate_variables(
        user.id, 2025, 1, [{"recurring_id": template.id, "amount": Decimal("50.00")}]
    )

    assert result.created == 0
    assert result.skipped == 1
    assert Transaction.objects.filter(
        recurring_source=template, year=2025, month=1
    ).count() == 1


def test_generate_variables_raises_for_non_variable_template():
    from apps.common.exceptions import DomainError

    user = UserFactory()
    template = RecurringExpenseFactory(user=user, is_variable=False)
    service = RecurringExpenseService()

    with pytest.raises(DomainError):
        service.generate_variables(
            user.id, 2025, 1, [{"recurring_id": template.id, "amount": Decimal("50.00")}]
        )
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && uv run pytest apps/transactions/tests/unit/test_recurring.py \
  -k "test_generate_variables" -v
```

Expected: 3 FAILED (AttributeError: 'RecurringExpenseService' has no attribute 'generate_variables').

- [ ] **Step 3: Implement generate_variables in services.py**

Add the following method to `RecurringExpenseService` in `backend/apps/transactions/services.py`:

```python
def generate_variables(
    self,
    user_id: int,
    year: int,
    month: int,
    overrides: list[dict],
) -> GenerationResultDTO:
    from apps.common.dtos import PendingVariableDTO
    from apps.common.exceptions import DomainError

    created = 0
    skipped = 0

    for override in overrides:
        template = self._recurring.get_by_id(override["recurring_id"], user_id)

        if not template.is_variable or template.status != RecurringStatus.ACTIVE:
            raise DomainError(
                f"RecurringExpense {template.id} is not variable or not active."
            )

        if self._recurring.exists_transaction_for_month(
            template.id, user_id, year, month
        ):
            skipped += 1
            continue

        day = min(template.due_day, calendar.monthrange(year, month)[1])
        date = datetime.date(year, month, day)

        self._tx.create(
            {
                "user_id": user_id,
                "type": TransactionType.EXPENSE,
                "kind": TransactionKind.FIXED,
                "category_id": template.category_id,
                "payment_method_id": template.payment_method_id,
                "description": template.description,
                "amount": override["amount"],
                "date": date,
                "year": year,
                "month": month,
                "is_paid": False,
                "recurring_source_id": template.id,
            }
        )
        created += 1

        template.generated_count += 1
        if (
            template.total_occurrences
            and template.generated_count >= template.total_occurrences
        ):
            template.status = RecurringStatus.PAUSED
        template.save()

    return GenerationResultDTO(
        created=created,
        skipped=skipped,
        completed_templates=[],
        pending_variables=[],
    )
```

- [ ] **Step 4: Run all recurring tests**

```bash
cd backend && uv run pytest apps/transactions/tests/unit/test_recurring.py -v
```

Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/transactions/services.py \
        backend/apps/transactions/tests/unit/test_recurring.py
git commit -m "feat: add generate_variables service method for variable recurring expenses"
```

---

## Task 5: API layer — serializer, views, urls

**Files:**
- Modify: `backend/apps/transactions/api/serializers.py`
- Modify: `backend/apps/transactions/api/views.py`
- Modify: `backend/apps/transactions/api/urls.py`

- [ ] **Step 1: Update RecurringExpenseSerializer and add GenerateVariableItemSerializer**

Replace `backend/apps/transactions/api/serializers.py` with:

```python
from decimal import Decimal

from rest_framework import serializers

from apps.core.api.serializers import CategorySerializer, PaymentMethodSerializer
from apps.transactions.models import Debt, RecurringExpense, Transaction


def _serialize_summary(summary):
    return {
        "year": summary.year,
        "month": summary.month,
        "total_income": str(summary.total_income),
        "total_expense": str(summary.total_expense),
        "total_fixed": str(summary.total_fixed),
        "total_variable": str(summary.total_variable),
        "total_invested": str(summary.total_invested),
        "balance": str(summary.balance),
        "pending_count": summary.pending_count,
        "investment_goal": str(summary.investment_goal),
        "by_category": [
            {
                "category_id": c["category_id"],
                "category_name": c["category__name"],
                "color": c["category__color"],
                "total": str(c["total"]),
                "budget": str(c.get("budget") or "0.00"),
                "budget_used_pct": str(
                    round(c["total"] / c["budget"] * 100, 2)
                    if c.get("budget")
                    else "0.00"
                ),
            }
            for c in summary.by_category
        ],
        "by_payment_method": [
            {
                "payment_method_id": p["payment_method_id"],
                "name": p["payment_method__name"],
                "total": str(p["total"]),
            }
            for p in summary.by_payment_method
        ],
    }


class TransactionSerializer(serializers.ModelSerializer):
    category_detail = CategorySerializer(source="category", read_only=True)
    payment_method_detail = PaymentMethodSerializer(
        source="payment_method", read_only=True
    )

    class Meta:
        model = Transaction
        fields = [
            "id",
            "type",
            "kind",
            "category",
            "category_detail",
            "description",
            "amount",
            "date",
            "year",
            "month",
            "payment_method",
            "payment_method_detail",
            "is_paid",
            "recurring_source",
            "installment_current",
            "installment_total",
        ]
        read_only_fields = [
            "id",
            "year",
            "month",
            "category_detail",
            "payment_method_detail",
        ]


class RecurringExpenseSerializer(serializers.ModelSerializer):
    category_detail = CategorySerializer(source="category", read_only=True)
    payment_method_detail = PaymentMethodSerializer(
        source="payment_method", read_only=True
    )

    class Meta:
        model = RecurringExpense
        fields = [
            "id",
            "description",
            "is_variable",
            "category",
            "category_detail",
            "payment_method",
            "payment_method_detail",
            "default_amount",
            "due_day",
            "status",
            "total_occurrences",
            "generated_count",
            "acquisition",
        ]
        read_only_fields = ["id", "generated_count"]

    def validate(self, data):
        is_variable = data.get(
            "is_variable", getattr(self.instance, "is_variable", False)
        )
        default_amount = data.get(
            "default_amount", getattr(self.instance, "default_amount", None)
        )
        if not is_variable and not default_amount:
            raise serializers.ValidationError(
                {"default_amount": ["Valor obrigatório para gastos de valor fixo."]}
            )
        return data


class GenerateVariableItemSerializer(serializers.Serializer):
    recurring_id = serializers.IntegerField()
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )


class DebtSerializer(serializers.ModelSerializer):
    class Meta:
        model = Debt
        fields = [
            "id",
            "debt_type",
            "creditor",
            "payment_method",
            "installment_current",
            "installment_total",
            "installment_amount",
            "total_amount",
            "start_date",
            "is_settled",
        ]
        read_only_fields = ["id"]
```

- [ ] **Step 2: Add GenerateVariablesView and update GenerateFixedView in views.py**

Replace `backend/apps/transactions/api/views.py` with:

```python
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
        "year", "month", "type", "kind", "category", "payment_method", "is_paid"
    ]
    search_fields = ["description"]

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user).select_related(
            "category", "payment_method"
        ).order_by("-date", "-id")

    def perform_create(self, serializer):
        data = serializer.validated_data
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
        tx = TransactionService().create(dto)
        serializer.instance = tx

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
        return Debt.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

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
```

- [ ] **Step 3: Register the new URL**

Replace `backend/apps/transactions/api/urls.py` with:

```python
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.transactions.api.views import (
    DebtViewSet,
    GenerateFixedView,
    GenerateVariablesView,
    MonthSummaryView,
    RecurringExpenseViewSet,
    TransactionViewSet,
)

router = DefaultRouter()
router.register("transactions", TransactionViewSet, basename="transaction")
router.register(
    "recurring-expenses", RecurringExpenseViewSet, basename="recurring-expense"
)
router.register("debts", DebtViewSet, basename="debt")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "months/<int:year>/<int:month>/summary/",
        MonthSummaryView.as_view({"get": "retrieve"}),
        name="month-summary",
    ),
    path(
        "months/<int:year>/<int:month>/generate-fixed/",
        GenerateFixedView.as_view({"post": "create"}),
        name="generate-fixed",
    ),
    path(
        "months/<int:year>/<int:month>/generate-variables/",
        GenerateVariablesView.as_view({"post": "create"}),
        name="generate-variables",
    ),
]
```

- [ ] **Step 4: Run the full test suite**

```bash
cd backend && uv run pytest --cov=apps --cov-fail-under=85 -q
```

Expected: all tests pass, coverage ≥ 85%.

- [ ] **Step 5: Lint check**

```bash
cd backend && uv run ruff check .
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/transactions/api/serializers.py \
        backend/apps/transactions/api/views.py \
        backend/apps/transactions/api/urls.py
git commit -m "feat: expose is_variable on serializer and add generate-variables endpoint"
```

---

## Task 6: Frontend — types, form, table badge, variable amounts modal

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/pages/RecurringExpenses.tsx`

- [ ] **Step 1: Update types/api.ts**

Add `PendingVariable` and `GenerateFixedResult` interfaces, update `RecurringExpense`:

In `frontend/src/types/api.ts`, replace the `RecurringExpense` interface:

```ts
export interface RecurringExpense {
  id: number
  description: string
  is_variable: boolean
  category: number | null
  category_detail: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null
  payment_method: number | null
  payment_method_detail: Pick<PaymentMethod, 'id' | 'name' | 'icon' | 'color'> | null
  default_amount: string | null
  due_day: number
  status: 'active' | 'paused'
  total_occurrences: number | null
  generated_count: number
  acquisition: number | null
}
```

Then add two new interfaces after `RecurringExpense`:

```ts
export interface PendingVariable {
  id: number
  description: string
  suggested_amount: string | null
  category_id: number | null
  payment_method_id: number | null
  due_day: number
}

export interface GenerateFixedResult {
  created: number
  skipped: number
  completed_templates: number[]
  pending_variables: PendingVariable[]
}
```

- [ ] **Step 2: Replace RecurringExpenses.tsx with updated version**

Replace the full content of `frontend/src/pages/RecurringExpenses.tsx` with:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usePeriod } from '@/contexts/PeriodContext'
import { api } from '@/api/client'
import MoneyText from '@/components/ui/MoneyText'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import CategoryBadge from '@/components/ui/CategoryBadge'
import { toast } from '@/components/ui/Toast'
import type {
  RecurringExpense,
  Category,
  PaymentMethod,
  PaginatedResponse,
  PendingVariable,
  GenerateFixedResult,
} from '@/types/api'
import { Plus, Pencil, Archive, RefreshCw } from 'lucide-react'

const schema = z
  .object({
    description: z.string().min(1, 'Descrição obrigatória'),
    is_variable: z.boolean().default(false),
    default_amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido')
      .optional()
      .or(z.literal('')),
    due_day: z.number().int().min(1).max(31),
    category: z.number().optional(),
    payment_method: z.number().optional(),
    status: z.enum(['active', 'paused']).default('active'),
    total_occurrences: z.number().int().positive().optional(),
  })
  .refine((data) => data.is_variable || Boolean(data.default_amount), {
    message: 'Valor obrigatório para gastos fixos',
    path: ['default_amount'],
  })

type FormData = z.infer<typeof schema>

function VariableAmountsModal({
  items,
  onSubmit,
  onCancel,
  isPending,
}: {
  items: PendingVariable[]
  onSubmit: (data: Array<{ recurring_id: number; amount: string }>) => void
  onCancel: () => void
  isPending: boolean
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ overrides: Array<{ recurring_id: number; amount: string }> }>({
    defaultValues: {
      overrides: items.map((item) => ({
        recurring_id: item.id,
        amount: item.suggested_amount ?? '',
      })),
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl">
        <h2 className="mb-2 text-base font-semibold text-text-primary">
          Preencher valores variáveis
        </h2>
        <p className="mb-5 text-xs text-text-muted">
          Informe o valor real de cada gasto variável deste mês.
        </p>
        <form onSubmit={handleSubmit((d) => onSubmit(d.overrides))} className="space-y-3">
          {items.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-4">
              <input
                type="hidden"
                {...register(`overrides.${idx}.recurring_id`, { valueAsNumber: true })}
              />
              <span className="flex-1 text-sm text-text-primary">{item.description}</span>
              <div className="w-36">
                <input
                  {...register(`overrides.${idx}.amount`, {
                    required: 'Obrigatório',
                    pattern: { value: /^\d+(\.\d{1,2})?$/, message: 'Inválido' },
                  })}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-right text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                />
                {errors.overrides?.[idx]?.amount && (
                  <p className="mt-0.5 text-xs text-danger">
                    {errors.overrides[idx].amount?.message}
                  </p>
                )}
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-4 py-2 text-sm text-text-muted hover:bg-elevated transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-accent/20 px-5 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function RecurringExpenses() {
  const { year, month } = usePeriod()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [archiveId, setArchiveId] = useState<number | null>(null)
  const [variableModalOpen, setVariableModalOpen] = useState(false)
  const [variablePending, setVariablePending] = useState<PendingVariable[]>([])

  const { data, isLoading } = useQuery<PaginatedResponse<RecurringExpense>>({
    queryKey: ['recurring-expenses'],
    queryFn: () =>
      api.get<PaginatedResponse<RecurringExpense>>('/recurring-expenses/').then((r) => r.data),
  })

  const { data: categories } = useQuery<PaginatedResponse<Category>>({
    queryKey: ['categories'],
    queryFn: () => api.get<PaginatedResponse<Category>>('/categories/').then((r) => r.data),
  })

  const { data: paymentMethods } = useQuery<PaginatedResponse<PaymentMethod>>({
    queryKey: ['payment-methods'],
    queryFn: () =>
      api.get<PaginatedResponse<PaymentMethod>>('/payment-methods/').then((r) => r.data),
  })

  const generateFixed = useMutation({
    mutationFn: () =>
      api
        .post<GenerateFixedResult>(`/months/${year}/${month}/generate-fixed/`)
        .then((r) => r.data),
    onSuccess: (result: GenerateFixedResult) => {
      queryClient.invalidateQueries({ queryKey: ['summary', year, month] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      if (result.pending_variables.length > 0) {
        setVariablePending(result.pending_variables)
        setVariableModalOpen(true)
        if (result.created > 0) {
          toast(`${result.created} lançamento(s) fixo(s) criado(s)`, 'success')
        }
      } else {
        toast(`${result.created} lançamento(s) criado(s)`, 'success')
      }
    },
    onError: () => toast('Erro ao gerar fixos', 'error'),
  })

  const generateVariables = useMutation({
    mutationFn: (overrides: Array<{ recurring_id: number; amount: string }>) =>
      api
        .post<{ created: number; skipped: number }>(
          `/months/${year}/${month}/generate-variables/`,
          overrides,
        )
        .then((r) => r.data),
    onSuccess: (result) => {
      toast(`${result.created} lançamento(s) variável(is) criado(s)`, 'success')
      setVariableModalOpen(false)
      setVariablePending([])
      queryClient.invalidateQueries({ queryKey: ['summary', year, month] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
    onError: () => toast('Erro ao gerar variáveis', 'error'),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<FormData>) => api.post('/recurring-expenses/', data),
    onSuccess: () => {
      toast('Gasto fixo criado', 'success')
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] })
      setModalOpen(false)
      reset()
    },
    onError: () => toast('Erro ao criar gasto fixo', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FormData> }) =>
      api.patch(`/recurring-expenses/${id}/`, data),
    onSuccess: () => {
      toast('Gasto fixo atualizado', 'success')
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] })
      setModalOpen(false)
      setEditingId(null)
      reset()
    },
    onError: () => toast('Erro ao atualizar', 'error'),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/recurring-expenses/${id}/`, { status: 'paused' }),
    onSuccess: () => {
      toast('Gasto fixo arquivado', 'success')
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] })
      setArchiveId(null)
    },
    onError: () => toast('Erro ao arquivar', 'error'),
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'active', due_day: 1, is_variable: false },
  })

  const isVariableWatched = watch('is_variable')

  const openEdit = (re: RecurringExpense) => {
    setEditingId(re.id)
    reset({
      description: re.description,
      is_variable: re.is_variable,
      default_amount: re.default_amount ?? '',
      due_day: re.due_day,
      category: re.category ?? undefined,
      payment_method: re.payment_method ?? undefined,
      status: re.status,
      total_occurrences: re.total_occurrences ?? undefined,
    })
    setModalOpen(true)
  }

  const onSubmit = (formData: FormData) => {
    const payload: Record<string, unknown> = { ...formData }
    if (!payload.category) delete payload.category
    if (!payload.payment_method) delete payload.payment_method
    if (!payload.total_occurrences) delete payload.total_occurrences
    if (!payload.default_amount) payload.default_amount = null
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload as Partial<FormData> })
    } else {
      createMutation.mutate(payload as Partial<FormData>)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Gastos Fixos</h1>
        <div className="flex gap-3">
          <button
            onClick={() => generateFixed.mutate()}
            disabled={generateFixed.isPending}
            className="flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2 text-sm text-text-muted hover:bg-elevated transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={generateFixed.isPending ? 'animate-spin' : ''} />
            Gerar este mês
          </button>
          <button
            onClick={() => {
              reset({ status: 'active', due_day: 1, is_variable: false })
              setEditingId(null)
              setModalOpen(true)
            }}
            className="flex items-center gap-2 rounded-xl bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors"
          >
            <Plus size={16} />
            Novo Gasto Fixo
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : !data?.results.length ? (
        <EmptyState
          icon={<RefreshCw size={32} />}
          title="Nenhum gasto fixo"
          description="Configure seus gastos recorrentes mensais"
        />
      ) : (
        <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                  Descrição
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                  Categoria
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Forma</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">
                  Vencimento
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">
                  Ocorrências
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {data.results.map((re) => (
                <tr key={re.id} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary">{re.description}</td>
                  <td className="px-4 py-3">
                    {re.category_detail ? (
                      <CategoryBadge
                        name={re.category_detail.name}
                        color={re.category_detail.color}
                      />
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {re.payment_method_detail?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {re.is_variable ? (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                        Variável
                      </span>
                    ) : re.default_amount ? (
                      <MoneyText value={re.default_amount} className="font-medium" />
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-text-muted">
                    Dia {re.due_day}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        re.status === 'active'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-text-muted/10 text-text-muted'
                      }`}
                    >
                      {re.status === 'active' ? 'Ativo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-text-muted">
                    {re.total_occurrences
                      ? `${re.generated_count}/${re.total_occurrences}`
                      : `${re.generated_count} gerado(s)`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(re)}
                        className="text-text-muted hover:text-info transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      {re.status === 'active' && (
                        <button
                          onClick={() => setArchiveId(re.id)}
                          className="text-text-muted hover:text-warning transition-colors"
                        >
                          <Archive size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl">
            <h2 className="mb-5 text-base font-semibold text-text-primary">
              {editingId ? 'Editar Gasto Fixo' : 'Novo Gasto Fixo'}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">
                  Descrição *
                </label>
                <input
                  {...register('description')}
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-danger">{errors.description.message}</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_variable"
                  {...register('is_variable')}
                  className="h-4 w-4 rounded border-border-subtle accent-accent"
                />
                <label htmlFor="is_variable" className="text-xs font-medium text-text-muted">
                  Valor variável (ex: luz, telefone)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    {isVariableWatched ? 'Valor Sugerido (opcional)' : 'Valor (R$) *'}
                  </label>
                  <input
                    {...register('default_amount')}
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                  />
                  {errors.default_amount && (
                    <p className="mt-1 text-xs text-danger">{errors.default_amount.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    Dia de Vencimento *
                  </label>
                  <input
                    {...register('due_day', { valueAsNumber: true })}
                    type="number"
                    min={1}
                    max={31}
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
                  />
                  {errors.due_day && (
                    <p className="mt-1 text-xs text-danger">{errors.due_day.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    Categoria
                  </label>
                  <select
                    {...register('category', {
                      setValueAs: (v) => (v === '' ? undefined : Number(v)),
                    })}
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-muted focus:border-accent/50 focus:outline-none"
                  >
                    <option value="">Selecionar...</option>
                    {categories?.results.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    Forma de Pagamento
                  </label>
                  <select
                    {...register('payment_method', {
                      setValueAs: (v) => (v === '' ? undefined : Number(v)),
                    })}
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-muted focus:border-accent/50 focus:outline-none"
                  >
                    <option value="">Selecionar...</option>
                    {paymentMethods?.results.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    Status
                  </label>
                  <select
                    {...register('status')}
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-muted focus:border-accent/50 focus:outline-none"
                  >
                    <option value="active">Ativo</option>
                    <option value="paused">Pausado</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    Total de Ocorrências
                  </label>
                  <input
                    {...register('total_occurrences', {
                      setValueAs: (v) => (v === '' ? undefined : Number(v)),
                    })}
                    type="number"
                    min={1}
                    placeholder="Ilimitado"
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false)
                    setEditingId(null)
                    reset()
                  }}
                  className="rounded-xl px-4 py-2 text-sm text-text-muted hover:bg-elevated transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-xl bg-accent/20 px-5 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Variable Amounts Modal */}
      {variableModalOpen && (
        <VariableAmountsModal
          items={variablePending}
          onSubmit={(overrides) => generateVariables.mutate(overrides)}
          onCancel={() => {
            setVariableModalOpen(false)
            setVariablePending([])
          }}
          isPending={generateVariables.isPending}
        />
      )}

      <ConfirmDialog
        open={archiveId !== null}
        title="Arquivar gasto fixo"
        description="O gasto fixo será pausado e não gerará mais lançamentos automaticamente."
        confirmLabel="Arquivar"
        onConfirm={() => archiveId !== null && archiveMutation.mutate(archiveId)}
        onCancel={() => setArchiveId(null)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Check TypeScript types compile**

```bash
cd frontend && npm run build 2>&1 | head -40
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/pages/RecurringExpenses.tsx
git commit -m "feat: variable recurring expenses — form checkbox, table badge, fill-in modal"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full backend test suite with coverage**

```bash
cd backend && uv run pytest --cov=apps --cov-fail-under=85 -q
```

Expected: all tests pass, coverage ≥ 85%.

- [ ] **Step 2: Lint**

```bash
cd backend && uv run ruff check .
```

Expected: no errors.

- [ ] **Step 3: Start dev server and smoke-test manually**

```bash
docker compose up -d
```

Manual checks:
1. Navigate to Gastos Fixos page
2. Create a new recurring expense with "Valor variável" checked — amount field label changes to "Valor Sugerido (opcional)"
3. Create one without the checkbox — amount field is required, submit without value shows error
4. In the table, the variable expense shows a "Variável" badge in the Valor column
5. Click "Gerar este mês" — if variable expenses exist, the fill-in modal appears with the suggested amount pre-filled
6. Submit the modal — toast confirms creation, transactions appear in Lançamentos
7. Click "Gerar este mês" again — modal does not appear again for already-created variables (skipped silently)
