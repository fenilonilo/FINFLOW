# Variable Recurring Expenses

**Date:** 2026-06-12  
**Status:** Approved  

## Problem

Some recurring expenses (electricity, phone) have amounts that vary each month. Today `RecurringExpense.default_amount` is required and copied verbatim to every generated transaction. There is no way to flag an expense as variable and prompt the user to enter the real amount at generation time.

## Solution

Add an `is_variable` flag to `RecurringExpense`. When generating for a month, variable expenses are skipped and returned as `pending_variables`. A dedicated endpoint accepts user-provided amounts and creates those transactions.

---

## Data Model

### `RecurringExpense` changes

```python
is_variable = models.BooleanField(default=False)
default_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
```

**Rules:**
- `is_variable=False` → `default_amount` required (enforced in service, not DB constraint)
- `is_variable=True` → `default_amount` optional; used as suggestion when prompting for real value

### New DTOs

```python
@dataclass
class PendingVariableDTO:
    id: int
    description: str
    suggested_amount: str | None   # str(default_amount) or None
    category_id: int | None
    payment_method_id: int | None
    due_day: int

@dataclass
class GenerationResultDTO:
    created: int
    skipped: int
    completed_templates: list[int]
    pending_variables: list[PendingVariableDTO]  # new field
```

---

## Service Layer

### `RecurringExpenseService.generate_for_month` (modified)

For each active template:
1. If already has transaction for `(user, recurring_source, year, month)` → `skipped += 1`, continue
2. If `is_variable=True` → append to `pending_variables`, continue (no transaction created, no counter increment)
3. Otherwise → create transaction with `default_amount`, increment `generated_count`

Variable expenses stay pending until the user fills in values. Calling generate multiple times is idempotent for both fixed and variable.

### `RecurringExpenseService.generate_variables` (new)

```python
def generate_variables(
    self,
    user_id: int,
    year: int,
    month: int,
    overrides: list[dict],  # [{recurring_id: int, amount: Decimal}]
) -> GenerationResultDTO
```

For each override:
- Load `RecurringExpense`, verify `user_id`, `is_variable=True`, `status=active`
- Verify no transaction exists yet for that month (idempotent: skip if already created)
- Create transaction with `kind=FIXED`, `type=EXPENSE`, user-supplied `amount`
- Increment `generated_count`

Returns `GenerationResultDTO(created, skipped, completed_templates=[], pending_variables=[])`.

---

## API

### Modified endpoint

`POST /api/v1/months/{year}/{month}/generate-fixed/`

Response gains new field:
```json
{
  "created": 3,
  "skipped": 1,
  "pending_variables": [
    {
      "id": 4,
      "description": "Luz",
      "suggested_amount": "180.00",
      "category_id": 2,
      "payment_method_id": null,
      "due_day": 10
    }
  ]
}
```

### New endpoint

`POST /api/v1/months/{year}/{month}/generate-variables/`

Request:
```json
[
  {"recurring_id": 4, "amount": "187.50"},
  {"recurring_id": 7, "amount": "92.00"}
]
```

Response:
```json
{"created": 2, "skipped": 0}
```

Errors follow the standard envelope: `{"detail": "...", "errors": {...}}`.

### `RecurringExpense` serializer changes

- `is_variable` field exposed (read/write)
- `default_amount` becomes non-required when `is_variable=true`

---

## Frontend

### Recurring Expenses form (create/edit)

- New checkbox `is_variable` (default: unchecked)
- When checked: "Valor (R$)" label changes to "Valor Sugerido (opcional)", validation becomes optional
- Table gains a "Variável" badge column shown when `is_variable=true`

### "Gerar este mês" flow

```
User clicks "Gerar este mês"
  → POST /months/{year}/{month}/generate-fixed/
  → If response.pending_variables.length > 0:
      → Open <VariableAmountsModal> with pending list
  → Else:
      → Toast success (current behavior)

<VariableAmountsModal>
  For each pending variable:
    - Description + category badge
    - Amount input, pre-filled with suggested_amount (or empty string)
  On submit:
    → POST /months/{year}/{month}/generate-variables/
    → Close modal + toast success
    → Invalidate queries: ['summary', year, month], ['transactions']
```

### `VariableAmountsModal`

Inline component inside `RecurringExpenses.tsx` (no new file). Reuses existing modal styles. Zod schema:

```ts
z.array(z.object({
  recurring_id: z.number(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido'),
}))
```

---

## Error Handling

- Submitting empty amount for any variable → Zod validation blocks submit
- Backend receives unknown `recurring_id` or non-variable → `400` with standard error envelope
- Duplicate submission (transaction already exists) → skipped silently, counted in `skipped`

---

## Testing

- **Unit:** `generate_for_month` skips variable templates, returns correct `pending_variables`
- **Unit:** `generate_variables` creates transactions with user amounts, increments counter
- **Unit:** `generate_variables` is idempotent (existing transaction = skip)
- **API:** `POST generate-fixed` returns `pending_variables` when variables exist
- **API:** `POST generate-variables` creates correct transactions
- **Frontend:** form toggles amount field required/optional based on `is_variable`
- **Frontend:** modal appears only when `pending_variables` is non-empty
