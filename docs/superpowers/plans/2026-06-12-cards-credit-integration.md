# Cartões Integrados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar cartões ao sistema: crédito/débito via PaymentMethod vinculada, fatura calculada automaticamente por ciclo de fechamento, limite comprometido e compra parcelada gerando Debt + N transações.

**Architecture:** `Transaction` é a fonte única de verdade. Cartão vincula-se a 1–2 `PaymentMethod` (`card_function` credit/debit). Compras crédito recebem competência (`year`/`month`) do mês da fatura; fatura = soma por competência; limite comprometido = soma das compras crédito em faturas não pagas; parcelado cria `Debt` + N transações com competências sequenciais. Spec: `docs/superpowers/specs/2026-06-12-cards-credit-integration-design.md`.

**Tech Stack:** Django 5 + DRF + UV (backend), React 18 + Vite + TS + Tailwind + TanStack Query + RHF/Zod (frontend).

**Orquestração FinFlow:** Task 1 → agent-db; Tasks 2–6 → agent-domain; Tasks 7–8 → agent-api; Tasks 9–11 → agent-front-pages; Task 12 → orquestrador.

**Comandos:** containers rodando → SEMPRE `docker compose exec backend uv run ...` e `docker compose exec frontend npm ...`. NUNCA `uv run`/`npm` no host contra o bind-mount (corrompe venv/node_modules — ver CLAUDE.md).

---

### Task 1: Models, migrações e factories (agent-db)

**Files:**
- Modify: `backend/apps/core/models.py`
- Modify: `backend/apps/cards/models.py`
- Modify: `backend/apps/transactions/models.py`
- Modify: `backend/apps/common/factories.py`
- Test: `backend/apps/core/tests/unit/test_payment_method_card.py` (criar; criar `__init__.py` nos diretórios se faltarem)
- Test: `backend/apps/transactions/tests/unit/test_transaction_competence.py`

- [ ] **Step 1: Testes falhando — vínculo PaymentMethod↔Card**

```python
# backend/apps/core/tests/unit/test_payment_method_card.py
import pytest
from django.db import IntegrityError

from apps.common.factories import CardFactory, PaymentMethodFactory
from apps.core.models import CardFunction

pytestmark = pytest.mark.django_db


def test_payment_method_links_card_with_function():
    card = CardFactory()
    pm = PaymentMethodFactory(
        user=card.user, card=card, card_function=CardFunction.CREDIT
    )
    assert pm.card == card
    assert pm.card_function == "credit"


def test_card_function_requires_card():
    with pytest.raises(IntegrityError):
        PaymentMethodFactory(card=None, card_function=CardFunction.CREDIT)


def test_card_without_function_rejected():
    card = CardFactory()
    with pytest.raises(IntegrityError):
        PaymentMethodFactory(user=card.user, card=card, card_function=None)


def test_one_payment_method_per_function_per_card():
    card = CardFactory()
    PaymentMethodFactory(user=card.user, card=card, card_function=CardFunction.CREDIT)
    with pytest.raises(IntegrityError):
        PaymentMethodFactory(
            user=card.user, card=card, card_function=CardFunction.CREDIT
        )
```

```python
# backend/apps/transactions/tests/unit/test_transaction_competence.py
import datetime

import pytest

from apps.common.factories import TransactionFactory

pytestmark = pytest.mark.django_db


def test_save_derives_competence_from_date_when_missing():
    tx = TransactionFactory(date=datetime.date(2026, 6, 5))
    assert (tx.year, tx.month) == (2026, 6)


def test_save_respects_preset_competence():
    tx = TransactionFactory(date=datetime.date(2026, 6, 5), year=2026, month=7)
    assert (tx.year, tx.month) == (2026, 7)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose exec backend uv run pytest apps/core/tests/unit/test_payment_method_card.py apps/transactions/tests/unit/test_transaction_competence.py -v`
Expected: FAIL (campos `card`/`card_function` inexistentes; competência sobrescrita).

- [ ] **Step 3: Implementar models**

Em `backend/apps/core/models.py`, antes de `PaymentMethod`:

```python
class CardFunction(models.TextChoices):
    CREDIT = "credit"
    DEBIT = "debit"
```

Dentro de `PaymentMethod`, após `color`:

```python
    card = models.ForeignKey(
        "cards.Card",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="payment_methods",
    )
    card_function = models.CharField(
        max_length=10, choices=CardFunction.choices, null=True, blank=True
    )
```

Na `Meta` de `PaymentMethod`, adicionar às `constraints` existentes:

```python
            models.UniqueConstraint(
                fields=["card", "card_function"],
                condition=models.Q(card__isnull=False),
                name="unique_card_function_per_card",
            ),
            models.CheckConstraint(
                check=(
                    models.Q(card__isnull=True, card_function__isnull=True)
                    | models.Q(card__isnull=False, card_function__isnull=False)
                ),
                name="card_and_function_together",
            ),
```

Em `backend/apps/cards/models.py`, dentro de `Card` após `due_day`:

```python
    limit = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
```

Em `backend/apps/transactions/models.py`:

```python
class DebtOrigin(models.TextChoices):
    MANUAL = "manual"
    CARD_PURCHASE = "card_purchase"
```

Dentro de `Debt`, após `debt_type`:

```python
    origin = models.CharField(
        max_length=20, choices=DebtOrigin.choices, default=DebtOrigin.MANUAL
    )
```

Dentro de `Transaction`, após `recurring_source`:

```python
    debt = models.ForeignKey(
        "transactions.Debt",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="installments",
    )
```

Substituir `Transaction.save`:

```python
    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.year or not self.month:
            self.year = self.date.year
            self.month = self.date.month
        super().save(*args, **kwargs)
```

- [ ] **Step 4: Migrações**

Run: `docker compose exec backend uv run python manage.py makemigrations core cards transactions && docker compose exec backend uv run python manage.py migrate`
Expected: 3 migrações criadas e aplicadas.

- [ ] **Step 5: Rodar testes novos + suíte inteira**

Run: `docker compose exec backend uv run pytest -v`
Expected: novos PASS. Se algum teste antigo depender de `save()` sobrescrever competência em update de `date`, ajustar o teste para o novo contrato (competência explícita vence).

- [ ] **Step 6: Commit**

```bash
git add backend/apps backend/apps/*/migrations
git commit -m "feat: card link em PaymentMethod, limit em Card, debt em Transaction, origin em Debt"
```

---

### Task 2: Funções puras de ciclo (agent-domain)

**Files:**
- Create: `backend/apps/cards/cycle.py`
- Test: `backend/apps/cards/tests/unit/test_cycle.py` (criar diretórios + `__init__.py`)

- [ ] **Step 1: Testes falhando**

```python
# backend/apps/cards/tests/unit/test_cycle.py
import datetime

from apps.cards.cycle import (
    add_months,
    competence_for_purchase,
    cycle_range,
    invoice_due_date,
)


def test_add_months_rolls_year():
    assert add_months(2026, 12, 1) == (2027, 1)
    assert add_months(2026, 1, -1) == (2025, 12)


def test_purchase_after_closing_goes_to_next_month():
    assert competence_for_purchase(3, datetime.date(2026, 6, 5)) == (2026, 7)


def test_purchase_on_closing_day_stays_in_month():
    assert competence_for_purchase(3, datetime.date(2026, 6, 3)) == (2026, 6)


def test_purchase_year_rollover():
    assert competence_for_purchase(3, datetime.date(2026, 12, 15)) == (2027, 1)


def test_closing_day_clamped_in_short_month():
    assert competence_for_purchase(31, datetime.date(2026, 2, 28)) == (2026, 2)
    assert competence_for_purchase(31, datetime.date(2026, 3, 1)) == (2026, 3)


def test_cycle_range_spans_previous_closing():
    start, end = cycle_range(3, 2026, 7)
    assert start == datetime.date(2026, 6, 4)
    assert end == datetime.date(2026, 7, 3)


def test_due_day_after_closing_same_month():
    assert invoice_due_date(3, 10, 2026, 6) == datetime.date(2026, 6, 10)


def test_due_day_before_closing_next_month():
    assert invoice_due_date(28, 5, 2026, 6) == datetime.date(2026, 7, 5)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose exec backend uv run pytest apps/cards/tests/unit/test_cycle.py -v`
Expected: FAIL `ModuleNotFoundError: apps.cards.cycle`.

- [ ] **Step 3: Implementar**

```python
# backend/apps/cards/cycle.py
"""Funções puras do ciclo de fatura. Sem ORM, sem side effects."""

import calendar
import datetime


def clamp_day(year: int, month: int, day: int) -> datetime.date:
    last = calendar.monthrange(year, month)[1]
    return datetime.date(year, month, min(day, last))


def add_months(year: int, month: int, delta: int) -> tuple[int, int]:
    idx = (year * 12 + month - 1) + delta
    return idx // 12, idx % 12 + 1


def competence_for_purchase(
    closing_day: int, purchase_date: datetime.date
) -> tuple[int, int]:
    """Mês da fatura (competência) que contém a data da compra."""
    closing = clamp_day(purchase_date.year, purchase_date.month, closing_day)
    if purchase_date <= closing:
        return purchase_date.year, purchase_date.month
    return add_months(purchase_date.year, purchase_date.month, 1)


def cycle_range(
    closing_day: int, year: int, month: int
) -> tuple[datetime.date, datetime.date]:
    """Janela de compras da fatura de (year, month)."""
    prev_year, prev_month = add_months(year, month, -1)
    start = clamp_day(prev_year, prev_month, closing_day) + datetime.timedelta(days=1)
    end = clamp_day(year, month, closing_day)
    return start, end


def invoice_due_date(
    closing_day: int, due_day: int, year: int, month: int
) -> datetime.date:
    if due_day > closing_day:
        return clamp_day(year, month, due_day)
    next_year, next_month = add_months(year, month, 1)
    return clamp_day(next_year, next_month, due_day)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `docker compose exec backend uv run pytest apps/cards/tests/unit/test_cycle.py -v`
Expected: 8 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/cards
git commit -m "feat: funcoes puras de ciclo de fatura (competencia, janela, vencimento)"
```

---

### Task 3: CardService — ciclo de vida cartão ↔ formas de pagamento (agent-domain)

**Files:**
- Modify: `backend/apps/cards/dtos.py` (hoje stub)
- Modify: `backend/apps/cards/repositories.py` (hoje stub)
- Modify: `backend/apps/cards/services.py` (hoje stub)
- Test: `backend/apps/cards/tests/unit/test_card_service.py`

- [ ] **Step 1: Testes falhando**

```python
# backend/apps/cards/tests/unit/test_card_service.py
from decimal import Decimal

import pytest

from apps.cards.dtos import CardWriteDTO
from apps.cards.services import CardService
from apps.common.exceptions import ValidationDomainError
from apps.common.factories import CardFactory, UserFactory
from apps.core.models import PaymentMethod

pytestmark = pytest.mark.django_db


def _dto(**overrides):
    base = dict(
        name="Nubank",
        color="#820ad1",
        closing_day=3,
        due_day=10,
        limit=Decimal("5000.00"),
        functions=["credit", "debit"],
    )
    base.update(overrides)
    return CardWriteDTO(**base)


def test_create_card_creates_payment_methods():
    user = UserFactory()
    card = CardService().create_card(user.id, _dto())
    pms = PaymentMethod.objects.filter(card=card).order_by("card_function")
    assert [pm.name for pm in pms] == ["Nubank Crédito", "Nubank Débito"]
    assert all(pm.color == "#820ad1" for pm in pms)
    assert card.limit == Decimal("5000.00")


def test_create_card_without_functions_fails():
    user = UserFactory()
    with pytest.raises(ValidationDomainError):
        CardService().create_card(user.id, _dto(functions=[]))


def test_update_card_renames_and_propagates():
    user = UserFactory()
    card = CardService().create_card(user.id, _dto())
    CardService().update_card(card.id, user.id, _dto(name="Inter", color="#ff7a00"))
    names = set(
        PaymentMethod.objects.filter(card=card).values_list("name", flat=True)
    )
    assert names == {"Inter Crédito", "Inter Débito"}


def test_update_card_removing_function_archives_it():
    user = UserFactory()
    card = CardService().create_card(user.id, _dto())
    CardService().update_card(card.id, user.id, _dto(functions=["credit"]))
    debit = PaymentMethod.objects.get(card=card, card_function="debit")
    assert debit.is_archived is True
    # re-adicionar reativa em vez de duplicar
    CardService().update_card(card.id, user.id, _dto(functions=["credit", "debit"]))
    debit.refresh_from_db()
    assert debit.is_archived is False
    assert PaymentMethod.objects.filter(card=card).count() == 2


def test_delete_card_archives_and_detaches_payment_methods():
    user = UserFactory()
    card = CardService().create_card(user.id, _dto())
    pm_ids = list(
        PaymentMethod.objects.filter(card=card).values_list("id", flat=True)
    )
    CardService().delete_card(card.id, user.id)
    for pm in PaymentMethod.objects.filter(id__in=pm_ids):
        assert pm.is_archived is True
        assert pm.card is None
        assert pm.card_function is None
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose exec backend uv run pytest apps/cards/tests/unit/test_card_service.py -v`
Expected: FAIL (DTO/serviço inexistentes).

- [ ] **Step 3: Implementar DTOs**

```python
# backend/apps/cards/dtos.py
import datetime
from dataclasses import dataclass, field
from decimal import Decimal


@dataclass
class CardWriteDTO:
    name: str
    color: str
    closing_day: int
    due_day: int
    limit: Decimal | None = None
    functions: list[str] = field(default_factory=list)


@dataclass
class InvoiceDTO:
    amount: Decimal
    snapshot_amount: Decimal | None
    is_paid: bool
    divergent: bool
    cycle_start: datetime.date
    cycle_end: datetime.date
    due_date: datetime.date


@dataclass
class CardSummaryDTO:
    card_id: int
    name: str
    color: str
    closing_day: int
    due_day: int
    functions: list[str]
    limit: Decimal | None
    committed: Decimal
    committed_pct: Decimal | None
    open_cycle_spend: Decimal
    invoice: InvoiceDTO
```

- [ ] **Step 4: Implementar repositories**

```python
# backend/apps/cards/repositories.py
from decimal import Decimal
from typing import Any

from django.db.models import Sum

from apps.cards.models import Card, CardInvoice
from apps.core.models import CardFunction, PaymentMethod
from apps.transactions.models import Debt, Transaction, TransactionType


class CardRepository:
    @staticmethod
    def get_by_id(card_id: int, user_id: int) -> Card:
        from apps.common.exceptions import NotFoundError

        try:
            return Card.objects.get(id=card_id, user_id=user_id)
        except Card.DoesNotExist:
            raise NotFoundError(f"Card {card_id} not found")

    @staticmethod
    def list_by_user(user_id: int) -> list[Card]:
        return list(
            Card.objects.filter(user_id=user_id).prefetch_related("payment_methods")
        )

    @staticmethod
    def create(user_id: int, data: dict[str, Any]) -> Card:
        return Card.objects.create(user_id=user_id, **data)


class CardPaymentMethodRepository:
    FUNCTION_LABELS = {CardFunction.CREDIT: "Crédito", CardFunction.DEBIT: "Débito"}

    @classmethod
    def get_or_create_function(cls, card: Card, function: str) -> PaymentMethod:
        pm = PaymentMethod.objects.filter(card=card, card_function=function).first()
        if pm:
            if pm.is_archived:
                pm.is_archived = False
                pm.save(update_fields=["is_archived"])
            return pm
        return PaymentMethod.objects.create(
            user_id=card.user_id,
            card=card,
            card_function=function,
            name=f"{card.name} {cls.FUNCTION_LABELS[function]}",
            color=card.color,
            icon="credit-card",
        )

    @staticmethod
    def active_functions(card: Card) -> list[str]:
        return list(
            PaymentMethod.objects.filter(card=card, is_archived=False).values_list(
                "card_function", flat=True
            )
        )

    @staticmethod
    def archive_function(card: Card, function: str) -> None:
        PaymentMethod.objects.filter(card=card, card_function=function).update(
            is_archived=True
        )

    @classmethod
    def sync_card_attrs(cls, card: Card) -> None:
        for pm in PaymentMethod.objects.filter(card=card):
            pm.name = f"{card.name} {cls.FUNCTION_LABELS[pm.card_function]}"
            pm.color = card.color
            pm.save(update_fields=["name", "color"])

    @staticmethod
    def detach_all(card: Card) -> None:
        PaymentMethod.objects.filter(card=card).update(
            card=None, card_function=None, is_archived=True
        )


class CardInvoiceRepository:
    @staticmethod
    def get(card_id: int, year: int, month: int) -> CardInvoice | None:
        return CardInvoice.objects.filter(
            card_id=card_id, year=year, month=month
        ).first()

    @staticmethod
    def get_or_create(
        card: Card, year: int, month: int, defaults: dict[str, Any]
    ) -> CardInvoice:
        invoice, _ = CardInvoice.objects.get_or_create(
            card=card, year=year, month=month, defaults=defaults
        )
        return invoice

    @staticmethod
    def paid_periods(card_id: int) -> list[tuple[int, int]]:
        return list(
            CardInvoice.objects.filter(card_id=card_id, is_paid=True).values_list(
                "year", "month"
            )
        )


class CardTransactionRepository:
    @staticmethod
    def _credit_qs(card_id: int):
        return Transaction.objects.filter(
            payment_method__card_id=card_id,
            payment_method__card_function=CardFunction.CREDIT,
            type=TransactionType.EXPENSE,
        )

    @classmethod
    def sum_for_competence(cls, card_id: int, year: int, month: int) -> Decimal:
        result = (
            cls._credit_qs(card_id)
            .filter(year=year, month=month)
            .aggregate(total=Sum("amount"))
        )
        return result["total"] or Decimal("0")

    @classmethod
    def sum_committed(
        cls, card_id: int, paid_periods: list[tuple[int, int]]
    ) -> Decimal:
        qs = cls._credit_qs(card_id)
        for year, month in paid_periods:
            qs = qs.exclude(year=year, month=month)
        return qs.aggregate(total=Sum("amount"))["total"] or Decimal("0")

    @classmethod
    def set_paid_for_competence(
        cls, card_id: int, year: int, month: int, is_paid: bool
    ) -> list[int]:
        ids = list(
            cls._credit_qs(card_id)
            .filter(year=year, month=month)
            .values_list("id", flat=True)
        )
        Transaction.objects.filter(id__in=ids).update(is_paid=is_paid)
        return ids

    @staticmethod
    def affected_debts(tx_ids: list[int]) -> list[Debt]:
        return list(Debt.objects.filter(installments__id__in=tx_ids).distinct())

    @staticmethod
    def paid_installment_numbers(debt_id: int) -> list[int]:
        return list(
            Transaction.objects.filter(debt_id=debt_id, is_paid=True)
            .exclude(installment_current=None)
            .values_list("installment_current", flat=True)
        )
```

- [ ] **Step 5: Implementar CardService**

Substituir conteúdo de `backend/apps/cards/services.py`:

```python
from django.db import transaction as db_transaction

from apps.cards.dtos import CardWriteDTO
from apps.cards.models import Card
from apps.cards.repositories import CardPaymentMethodRepository, CardRepository


class CardService:
    def create_card(self, user_id: int, dto: CardWriteDTO) -> Card:
        self._validate_functions(dto)
        with db_transaction.atomic():
            card = CardRepository.create(
                user_id,
                {
                    "name": dto.name,
                    "color": dto.color,
                    "closing_day": dto.closing_day,
                    "due_day": dto.due_day,
                    "limit": dto.limit,
                },
            )
            for function in dto.functions:
                CardPaymentMethodRepository.get_or_create_function(card, function)
        return card

    def update_card(self, card_id: int, user_id: int, dto: CardWriteDTO) -> Card:
        self._validate_functions(dto)
        with db_transaction.atomic():
            card = CardRepository.get_by_id(card_id, user_id)
            card.name = dto.name
            card.color = dto.color
            card.closing_day = dto.closing_day
            card.due_day = dto.due_day
            card.limit = dto.limit
            card.save()
            CardPaymentMethodRepository.sync_card_attrs(card)
            current = set(CardPaymentMethodRepository.active_functions(card))
            wanted = set(dto.functions)
            for function in wanted - current:
                CardPaymentMethodRepository.get_or_create_function(card, function)
            for function in current - wanted:
                CardPaymentMethodRepository.archive_function(card, function)
        return card

    def delete_card(self, card_id: int, user_id: int) -> None:
        with db_transaction.atomic():
            card = CardRepository.get_by_id(card_id, user_id)
            CardPaymentMethodRepository.detach_all(card)
            card.delete()

    @staticmethod
    def _validate_functions(dto: CardWriteDTO) -> None:
        from apps.common.exceptions import ValidationDomainError

        if not dto.functions:
            raise ValidationDomainError(
                {"functions": ["Escolha ao menos uma função (crédito/débito)."]}
            )
```

- [ ] **Step 6: Rodar e ver passar**

Run: `docker compose exec backend uv run pytest apps/cards/tests/unit/test_card_service.py -v`
Expected: 5 PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/apps/cards
git commit -m "feat: CardService cria/sincroniza/arquiva formas de pagamento do cartao"
```

---

### Task 4: Competência crédito no TransactionService (agent-domain)

**Files:**
- Modify: `backend/apps/core/repositories.py`
- Modify: `backend/apps/transactions/services.py`
- Test: `backend/apps/transactions/tests/unit/test_credit_competence.py`

- [ ] **Step 1: Testes falhando**

```python
# backend/apps/transactions/tests/unit/test_credit_competence.py
import datetime
from decimal import Decimal

import pytest

from apps.common.dtos import CreateTransactionDTO
from apps.common.factories import (
    CardFactory,
    CategoryFactory,
    PaymentMethodFactory,
    UserFactory,
)
from apps.core.models import CardFunction
from apps.transactions.services import TransactionService

pytestmark = pytest.mark.django_db


def _setup(card_function):
    user = UserFactory()
    card = CardFactory(user=user, closing_day=3, due_day=10)
    pm = PaymentMethodFactory(user=user, card=card, card_function=card_function)
    category = CategoryFactory(user=user)
    return user, pm, category


def _dto(user, pm, category, date):
    return CreateTransactionDTO(
        user_id=user.id,
        type="expense",
        kind="variable",
        description="Compra teste",
        amount=Decimal("100.00"),
        date=date,
        category_id=category.id,
        payment_method_id=pm.id,
    )


def test_credit_purchase_after_closing_lands_next_month():
    user, pm, category = _setup(CardFunction.CREDIT)
    tx = TransactionService().create(
        _dto(user, pm, category, datetime.date(2026, 6, 5))
    )
    assert (tx.year, tx.month) == (2026, 7)
    assert tx.date == datetime.date(2026, 6, 5)


def test_credit_purchase_before_closing_stays_in_month():
    user, pm, category = _setup(CardFunction.CREDIT)
    tx = TransactionService().create(
        _dto(user, pm, category, datetime.date(2026, 6, 2))
    )
    assert (tx.year, tx.month) == (2026, 6)


def test_debit_purchase_uses_purchase_month():
    user, pm, category = _setup(CardFunction.DEBIT)
    tx = TransactionService().create(
        _dto(user, pm, category, datetime.date(2026, 6, 5))
    )
    assert (tx.year, tx.month) == (2026, 6)


def test_non_card_payment_method_uses_purchase_month():
    user = UserFactory()
    pm = PaymentMethodFactory(user=user)
    category = CategoryFactory(user=user)
    tx = TransactionService().create(
        _dto(user, pm, category, datetime.date(2026, 6, 5))
    )
    assert (tx.year, tx.month) == (2026, 6)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose exec backend uv run pytest apps/transactions/tests/unit/test_credit_competence.py -v`
Expected: FAIL no primeiro teste (competência = junho, não julho).

- [ ] **Step 3: Implementar**

Em `backend/apps/core/repositories.py`, adicionar a `PaymentMethodRepository`:

```python
    @staticmethod
    def get_with_card(pm_id: int, user_id: int) -> PaymentMethod:
        from apps.common.exceptions import NotFoundError

        try:
            return PaymentMethod.objects.select_related("card").get(
                id=pm_id, user_id=user_id
            )
        except PaymentMethod.DoesNotExist:
            raise NotFoundError(f"PaymentMethod {pm_id} not found")
```

Em `backend/apps/transactions/services.py`, adicionar imports:

```python
from apps.cards.cycle import competence_for_purchase
from apps.core.models import CardFunction
from apps.core.repositories import PaymentMethodRepository
```

Adicionar método a `TransactionService`:

```python
    def resolve_competence(
        self,
        user_id: int,
        payment_method_id: int | None,
        date: datetime.date,
    ) -> tuple[int, int]:
        if payment_method_id:
            pm = PaymentMethodRepository.get_with_card(payment_method_id, user_id)
            if pm.card_function == CardFunction.CREDIT and pm.card_id:
                return competence_for_purchase(pm.card.closing_day, date)
        return date.year, date.month
```

Em `TransactionService.create`, trocar `"year": dto.date.year, "month": dto.date.month` por:

```python
        year, month = self.resolve_competence(
            dto.user_id, dto.payment_method_id, dto.date
        )
```

e no dict do repo: `"year": year, "month": month`.

- [ ] **Step 4: Rodar e ver passar**

Run: `docker compose exec backend uv run pytest apps/transactions/tests/unit/test_credit_competence.py -v`
Expected: 4 PASS. Rodar também `docker compose exec backend uv run pytest apps/transactions -v` (sem regressão).

- [ ] **Step 5: Commit**

```bash
git add backend/apps
git commit -m "feat: competencia de compra credito segue ciclo da fatura"
```

---

### Task 5: Parcelado no crédito → Debt + N transações (agent-domain)

**Files:**
- Modify: `backend/apps/common/dtos.py` (campo `installments` no CreateTransactionDTO não é necessário — parâmetro separado)
- Modify: `backend/apps/transactions/repositories.py`
- Modify: `backend/apps/transactions/services.py`
- Test: `backend/apps/transactions/tests/unit/test_installment_purchase.py`

- [ ] **Step 1: Testes falhando**

```python
# backend/apps/transactions/tests/unit/test_installment_purchase.py
import datetime
from decimal import Decimal

import pytest

from apps.common.dtos import CreateTransactionDTO
from apps.common.exceptions import ValidationDomainError
from apps.common.factories import (
    CardFactory,
    CategoryFactory,
    PaymentMethodFactory,
    UserFactory,
)
from apps.core.models import CardFunction
from apps.transactions.models import Debt, DebtOrigin
from apps.transactions.services import TransactionService

pytestmark = pytest.mark.django_db


def _setup(card_function=CardFunction.CREDIT):
    user = UserFactory()
    card = CardFactory(user=user, closing_day=3, due_day=10)
    pm = PaymentMethodFactory(user=user, card=card, card_function=card_function)
    category = CategoryFactory(user=user)
    return user, pm, category


def _dto(user, pm, category, amount="1200.00", date=datetime.date(2026, 6, 5)):
    return CreateTransactionDTO(
        user_id=user.id,
        type="expense",
        kind="variable",
        description="Notebook",
        amount=Decimal(amount),
        date=date,
        category_id=category.id,
        payment_method_id=pm.id,
    )


def test_creates_debt_and_installments():
    user, pm, category = _setup()
    txs = TransactionService().create_installment_purchase(
        _dto(user, pm, category), installments=6
    )
    debt = Debt.objects.get(user=user)
    assert debt.origin == DebtOrigin.CARD_PURCHASE
    assert debt.creditor == "Notebook"
    assert debt.total_amount == Decimal("1200.00")
    assert debt.installment_total == 6
    assert debt.installment_current == 0
    assert len(txs) == 6
    # compra 05/06 fecha dia 3 → 1ª parcela competência julho
    assert (txs[0].year, txs[0].month) == (2026, 7)
    assert (txs[5].year, txs[5].month) == (2026, 12)
    assert all(tx.debt_id == debt.id for tx in txs)
    assert all(tx.amount == Decimal("200.00") for tx in txs)
    assert [tx.installment_current for tx in txs] == [1, 2, 3, 4, 5, 6]


def test_cent_adjustment_on_last_installment():
    user, pm, category = _setup()
    txs = TransactionService().create_installment_purchase(
        _dto(user, pm, category, amount="100.00"), installments=3
    )
    amounts = [tx.amount for tx in txs]
    assert amounts == [Decimal("33.33"), Decimal("33.33"), Decimal("33.34")]
    assert sum(amounts) == Decimal("100.00")


def test_year_rollover_competences():
    user, pm, category = _setup()
    txs = TransactionService().create_installment_purchase(
        _dto(user, pm, category, date=datetime.date(2026, 11, 20)), installments=3
    )
    assert [(t.year, t.month) for t in txs] == [(2026, 12), (2027, 1), (2027, 2)]


def test_rejects_non_credit_payment_method():
    user, pm, category = _setup(card_function=CardFunction.DEBIT)
    with pytest.raises(ValidationDomainError):
        TransactionService().create_installment_purchase(
            _dto(user, pm, category), installments=3
        )


def test_rejects_single_installment():
    user, pm, category = _setup()
    with pytest.raises(ValidationDomainError):
        TransactionService().create_installment_purchase(
            _dto(user, pm, category), installments=1
        )
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose exec backend uv run pytest apps/transactions/tests/unit/test_installment_purchase.py -v`
Expected: FAIL `AttributeError: create_installment_purchase`.

- [ ] **Step 3: Implementar**

Em `backend/apps/transactions/repositories.py`, adicionar:

```python
class DebtRepository:
    @staticmethod
    def create(data: dict[str, Any]) -> "Debt":
        return Debt.objects.create(**data)

    @staticmethod
    def get_by_id(debt_id: int, user_id: int) -> "Debt":
        from apps.common.exceptions import NotFoundError

        try:
            return Debt.objects.get(id=debt_id, user_id=user_id)
        except Debt.DoesNotExist:
            raise NotFoundError(f"Debt {debt_id} not found")

    @staticmethod
    def delete_card_debt(debt: "Debt") -> None:
        debt.installments.filter(is_paid=False).delete()
        debt.installments.filter(is_paid=True).update(debt=None)
        debt.delete()
```

(importar `Debt` no topo do arquivo junto aos demais models.)

Em `backend/apps/transactions/services.py`:

Imports adicionais:

```python
from decimal import ROUND_FLOOR

from django.db import transaction as db_transaction

from apps.cards.cycle import add_months
from apps.transactions.models import DebtOrigin
from apps.transactions.repositories import DebtRepository
```

Métodos em `TransactionService`:

```python
    def create_installment_purchase(
        self, dto: CreateTransactionDTO, installments: int
    ) -> list[Transaction]:
        from apps.common.exceptions import ValidationDomainError

        errors: dict[str, list[str]] = {}
        if installments < 2:
            errors["installments"] = ["Mínimo de 2 parcelas."]
        if dto.amount <= Decimal("0"):
            errors["amount"] = ["Valor deve ser maior que zero."]
        if not dto.category_id:
            errors["category"] = ["Categoria é obrigatória para despesas."]

        pm = None
        if not dto.payment_method_id:
            errors["payment_method"] = ["Forma de pagamento é obrigatória."]
        else:
            pm = PaymentMethodRepository.get_with_card(
                dto.payment_method_id, dto.user_id
            )
            if pm.card_function != CardFunction.CREDIT or not pm.card_id:
                errors["payment_method"] = [
                    "Parcelamento só é permitido em cartão de crédito."
                ]

        if errors:
            raise ValidationDomainError(errors)

        per_installment = (dto.amount / installments).quantize(
            Decimal("0.01"), rounding=ROUND_FLOOR
        )
        last_installment = dto.amount - per_installment * (installments - 1)
        base_year, base_month = competence_for_purchase(
            pm.card.closing_day, dto.date
        )

        with db_transaction.atomic():
            debt = DebtRepository.create(
                {
                    "user_id": dto.user_id,
                    "debt_type": "credit_card",
                    "origin": DebtOrigin.CARD_PURCHASE,
                    "creditor": dto.description,
                    "payment_method_id": dto.payment_method_id,
                    "installment_current": 0,
                    "installment_total": installments,
                    "installment_amount": per_installment,
                    "total_amount": dto.amount,
                    "start_date": dto.date,
                }
            )
            txs = []
            for number in range(1, installments + 1):
                year, month = add_months(base_year, base_month, number - 1)
                amount = (
                    last_installment if number == installments else per_installment
                )
                txs.append(
                    self._tx.create(
                        {
                            "user_id": dto.user_id,
                            "type": dto.type,
                            "kind": dto.kind,
                            "category_id": dto.category_id,
                            "payment_method_id": dto.payment_method_id,
                            "description": dto.description,
                            "amount": amount,
                            "date": dto.date,
                            "year": year,
                            "month": month,
                            "is_paid": False,
                            "debt_id": debt.id,
                            "installment_current": number,
                            "installment_total": installments,
                        }
                    )
                )
        return txs


class DebtService:
    def delete(self, debt_id: int, user_id: int) -> None:
        debt = DebtRepository.get_by_id(debt_id, user_id)
        with db_transaction.atomic():
            if debt.origin == DebtOrigin.CARD_PURCHASE:
                DebtRepository.delete_card_debt(debt)
            else:
                debt.delete()
```

- [ ] **Step 4: Rodar e ver passar**

Run: `docker compose exec backend uv run pytest apps/transactions/tests/unit/test_installment_purchase.py -v`
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/transactions
git commit -m "feat: compra parcelada no credito gera Debt e N parcelas com competencia da fatura"
```

---

### Task 6: CardInvoiceService — summary, pagar/despagar, avanço de dívida (agent-domain)

**Files:**
- Modify: `backend/apps/cards/services.py`
- Test: `backend/apps/cards/tests/unit/test_invoice_service.py`

- [ ] **Step 1: Testes falhando**

```python
# backend/apps/cards/tests/unit/test_invoice_service.py
import datetime
from decimal import Decimal

import pytest

from apps.cards.services import CardInvoiceService
from apps.common.dtos import CreateTransactionDTO
from apps.common.factories import (
    CardFactory,
    CategoryFactory,
    PaymentMethodFactory,
    UserFactory,
)
from apps.core.models import CardFunction
from apps.transactions.models import Debt, Transaction
from apps.transactions.services import TransactionService

pytestmark = pytest.mark.django_db


@pytest.fixture
def env():
    user = UserFactory()
    card = CardFactory(
        user=user, closing_day=3, due_day=10, limit=Decimal("5000.00")
    )
    pm = PaymentMethodFactory(user=user, card=card, card_function=CardFunction.CREDIT)
    category = CategoryFactory(user=user)
    return user, card, pm, category


def _buy(user, pm, category, amount, date):
    return TransactionService().create(
        CreateTransactionDTO(
            user_id=user.id,
            type="expense",
            kind="variable",
            description="Compra",
            amount=Decimal(amount),
            date=date,
            category_id=category.id,
            payment_method_id=pm.id,
        )
    )


def test_summary_computes_invoice_and_committed(env):
    user, card, pm, category = env
    _buy(user, pm, category, "100.00", datetime.date(2026, 6, 2))  # fatura jun
    _buy(user, pm, category, "50.00", datetime.date(2026, 6, 10))  # fatura jul
    [summary] = CardInvoiceService().summary(user.id, 2026, 6)
    assert summary.invoice.amount == Decimal("100.00")
    assert summary.committed == Decimal("150.00")
    assert summary.committed_pct == Decimal("3.00")
    assert summary.invoice.cycle_start == datetime.date(2026, 5, 4)
    assert summary.invoice.cycle_end == datetime.date(2026, 6, 3)
    assert summary.invoice.due_date == datetime.date(2026, 6, 10)
    assert summary.invoice.is_paid is False


def test_pay_invoice_snapshots_and_marks_transactions(env):
    user, card, pm, category = env
    tx = _buy(user, pm, category, "100.00", datetime.date(2026, 6, 2))
    invoice = CardInvoiceService().set_invoice_paid(
        user.id, card.id, 2026, 6, is_paid=True
    )
    assert invoice.is_paid is True
    assert invoice.snapshot_amount == Decimal("100.00")
    tx.refresh_from_db()
    assert tx.is_paid is True
    # fatura paga sai do comprometido
    [summary] = CardInvoiceService().summary(user.id, 2026, 6)
    assert summary.committed == Decimal("0")


def test_pay_invoice_advances_card_debt(env):
    user, card, pm, category = env
    TransactionService().create_installment_purchase(
        CreateTransactionDTO(
            user_id=user.id,
            type="expense",
            kind="variable",
            description="Notebook",
            amount=Decimal("300.00"),
            date=datetime.date(2026, 6, 5),  # 1ª parcela julho
            category_id=category.id,
            payment_method_id=pm.id,
        ),
        installments=3,
    )
    CardInvoiceService().set_invoice_paid(user.id, card.id, 2026, 7, is_paid=True)
    debt = Debt.objects.get(user=user)
    assert debt.installment_current == 1
    assert debt.is_settled is False


def test_unpay_invoice_reverts_debt_and_transactions(env):
    user, card, pm, category = env
    TransactionService().create_installment_purchase(
        CreateTransactionDTO(
            user_id=user.id,
            type="expense",
            kind="variable",
            description="Notebook",
            amount=Decimal("300.00"),
            date=datetime.date(2026, 6, 5),
            category_id=category.id,
            payment_method_id=pm.id,
        ),
        installments=3,
    )
    service = CardInvoiceService()
    service.set_invoice_paid(user.id, card.id, 2026, 7, is_paid=True)
    service.set_invoice_paid(user.id, card.id, 2026, 7, is_paid=False)
    debt = Debt.objects.get(user=user)
    assert debt.installment_current == 0
    assert (
        Transaction.objects.filter(debt=debt, is_paid=True).count() == 0
    )


def test_divergent_when_retroactive_purchase_after_payment(env):
    user, card, pm, category = env
    _buy(user, pm, category, "100.00", datetime.date(2026, 6, 2))
    CardInvoiceService().set_invoice_paid(user.id, card.id, 2026, 6, is_paid=True)
    _buy(user, pm, category, "40.00", datetime.date(2026, 6, 1))  # retroativa
    [summary] = CardInvoiceService().summary(user.id, 2026, 6)
    assert summary.invoice.snapshot_amount == Decimal("100.00")
    assert summary.invoice.amount == Decimal("140.00")
    assert summary.invoice.divergent is True
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose exec backend uv run pytest apps/cards/tests/unit/test_invoice_service.py -v`
Expected: FAIL `ImportError: CardInvoiceService`.

- [ ] **Step 3: Implementar**

Adicionar a `backend/apps/cards/services.py`:

```python
import datetime
from decimal import Decimal

from apps.cards.cycle import competence_for_purchase, cycle_range, invoice_due_date
from apps.cards.dtos import CardSummaryDTO, InvoiceDTO
from apps.cards.repositories import (
    CardInvoiceRepository,
    CardTransactionRepository,
)


class CardInvoiceService:
    def summary(
        self, user_id: int, year: int, month: int
    ) -> list[CardSummaryDTO]:
        today = datetime.date.today()
        result = []
        for card in CardRepository.list_by_user(user_id):
            invoice_dto = self._build_invoice_dto(card, year, month)
            committed = CardTransactionRepository.sum_committed(
                card.id, CardInvoiceRepository.paid_periods(card.id)
            )
            committed_pct = (
                (committed / card.limit * 100).quantize(Decimal("0.01"))
                if card.limit
                else None
            )
            open_year, open_month = competence_for_purchase(
                card.closing_day, today
            )
            open_cycle_spend = CardTransactionRepository.sum_for_competence(
                card.id, open_year, open_month
            )
            functions = [
                pm.card_function
                for pm in card.payment_methods.all()
                if not pm.is_archived
            ]
            result.append(
                CardSummaryDTO(
                    card_id=card.id,
                    name=card.name,
                    color=card.color,
                    closing_day=card.closing_day,
                    due_day=card.due_day,
                    functions=functions,
                    limit=card.limit,
                    committed=committed,
                    committed_pct=committed_pct,
                    open_cycle_spend=open_cycle_spend,
                    invoice=invoice_dto,
                )
            )
        return result

    def set_invoice_paid(
        self, user_id: int, card_id: int, year: int, month: int, is_paid: bool
    ) -> InvoiceDTO:
        from apps.transactions.repositories import DebtRepository  # noqa: F401

        card = CardRepository.get_by_id(card_id, user_id)
        computed = CardTransactionRepository.sum_for_competence(
            card.id, year, month
        )
        due = invoice_due_date(card.closing_day, card.due_day, year, month)
        with db_transaction.atomic():
            invoice = CardInvoiceRepository.get_or_create(
                card,
                year,
                month,
                defaults={"amount": computed, "due_date": due, "is_paid": False},
            )
            invoice.amount = computed
            invoice.due_date = due
            invoice.is_paid = is_paid
            invoice.save()
            tx_ids = CardTransactionRepository.set_paid_for_competence(
                card.id, year, month, is_paid
            )
            for debt in CardTransactionRepository.affected_debts(tx_ids):
                paid_numbers = CardTransactionRepository.paid_installment_numbers(
                    debt.id
                )
                debt.installment_current = max(paid_numbers, default=0)
                debt.is_settled = (
                    debt.installment_current >= debt.installment_total
                )
                debt.save(update_fields=["installment_current", "is_settled"])
        return self._build_invoice_dto(card, year, month)

    def _build_invoice_dto(self, card, year: int, month: int) -> InvoiceDTO:
        computed = CardTransactionRepository.sum_for_competence(
            card.id, year, month
        )
        invoice = CardInvoiceRepository.get(card.id, year, month)
        is_paid = bool(invoice and invoice.is_paid)
        snapshot = invoice.amount if is_paid else None
        start, end = cycle_range(card.closing_day, year, month)
        return InvoiceDTO(
            amount=computed,
            snapshot_amount=snapshot,
            is_paid=is_paid,
            divergent=is_paid and snapshot != computed,
            cycle_start=start,
            cycle_end=end,
            due_date=invoice_due_date(
                card.closing_day, card.due_day, year, month
            ),
        )
```

(reusar imports já presentes: `db_transaction`, `CardRepository`.)

- [ ] **Step 4: Rodar e ver passar**

Run: `docker compose exec backend uv run pytest apps/cards -v`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/cards
git commit -m "feat: CardInvoiceService com summary, snapshot de fatura e avanco de divida"
```

---

### Task 7: API de cartões — summary, pay-invoice, functions/limit (agent-api)

**Files:**
- Modify: `backend/apps/cards/api/serializers.py`
- Modify: `backend/apps/cards/api/views.py`
- Test: `backend/apps/cards/tests/api/test_cards_api.py` (criar diretório `tests/api/` + `__init__.py` se faltar; seguir padrão de autenticação dos testes de API existentes em `apps/transactions/tests/`)

- [ ] **Step 1: Testes falhando**

```python
# backend/apps/cards/tests/api/test_cards_api.py
import datetime
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.common.dtos import CreateTransactionDTO
from apps.common.factories import CategoryFactory, UserFactory
from apps.core.models import PaymentMethod
from apps.transactions.services import TransactionService

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    user = UserFactory()
    api = APIClient()
    api.force_authenticate(user=user)
    return api, user


def test_create_card_with_functions_and_limit(client):
    api, user = client
    resp = api.post(
        "/api/v1/cards/",
        {
            "name": "Nubank",
            "color": "#820ad1",
            "closing_day": 3,
            "due_day": 10,
            "limit": "5000.00",
            "functions": ["credit", "debit"],
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["limit"] == "5000.00"
    assert sorted(resp.data["active_functions"]) == ["credit", "debit"]
    assert PaymentMethod.objects.filter(user=user, card__isnull=False).count() == 2


def test_create_card_without_functions_returns_validation_envelope(client):
    api, _ = client
    resp = api.post(
        "/api/v1/cards/",
        {"name": "X", "color": "#fff", "closing_day": 3, "due_day": 10,
         "functions": []},
        format="json",
    )
    assert resp.status_code == 400
    assert "functions" in resp.data["errors"]


def test_summary_and_pay_invoice_flow(client):
    api, user = client
    resp = api.post(
        "/api/v1/cards/",
        {"name": "Nubank", "color": "#820ad1", "closing_day": 3, "due_day": 10,
         "limit": "1000.00", "functions": ["credit"]},
        format="json",
    )
    card_id = resp.data["id"]
    pm = PaymentMethod.objects.get(card_id=card_id, card_function="credit")
    category = CategoryFactory(user=user)
    TransactionService().create(
        CreateTransactionDTO(
            user_id=user.id,
            type="expense",
            kind="variable",
            description="Compra",
            amount=Decimal("250.00"),
            date=datetime.date(2026, 6, 2),
            category_id=category.id,
            payment_method_id=pm.id,
        )
    )

    resp = api.get("/api/v1/cards/summary/", {"year": 2026, "month": 6})
    assert resp.status_code == 200
    [card] = resp.data
    assert card["invoice"]["amount"] == "250.00"
    assert card["committed"] == "250.00"
    assert card["committed_pct"] == "25.00"
    assert card["invoice"]["is_paid"] is False

    resp = api.post(
        f"/api/v1/cards/{card_id}/pay-invoice/",
        {"year": 2026, "month": 6, "is_paid": True},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["is_paid"] is True
    assert resp.data["snapshot_amount"] == "250.00"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose exec backend uv run pytest apps/cards/tests/api -v`
Expected: FAIL (campos/rotas inexistentes).

- [ ] **Step 3: Serializers**

Substituir `CardSerializer` em `backend/apps/cards/api/serializers.py`:

```python
from rest_framework import serializers

from apps.cards.models import Card, CardInvoice
from apps.core.models import CardFunction


class CardSerializer(serializers.ModelSerializer):
    functions = serializers.ListField(
        child=serializers.ChoiceField(choices=CardFunction.choices),
        write_only=True,
        required=True,
    )
    active_functions = serializers.SerializerMethodField()

    class Meta:
        model = Card
        fields = [
            "id", "name", "color", "closing_day", "due_day",
            "limit", "functions", "active_functions",
        ]
        read_only_fields = ["id", "active_functions"]

    def get_active_functions(self, obj):
        return [
            pm.card_function
            for pm in obj.payment_methods.all()
            if not pm.is_archived
        ]


class PayInvoiceSerializer(serializers.Serializer):
    year = serializers.IntegerField(min_value=2000, max_value=2100)
    month = serializers.IntegerField(min_value=1, max_value=12)
    is_paid = serializers.BooleanField(default=True)


def serialize_invoice(dto):
    return {
        "amount": str(dto.amount),
        "snapshot_amount": (
            str(dto.snapshot_amount) if dto.snapshot_amount is not None else None
        ),
        "is_paid": dto.is_paid,
        "divergent": dto.divergent,
        "cycle_start": dto.cycle_start.isoformat(),
        "cycle_end": dto.cycle_end.isoformat(),
        "due_date": dto.due_date.isoformat(),
    }


def serialize_card_summary(dto):
    return {
        "card_id": dto.card_id,
        "name": dto.name,
        "color": dto.color,
        "closing_day": dto.closing_day,
        "due_day": dto.due_day,
        "functions": dto.functions,
        "limit": str(dto.limit) if dto.limit is not None else None,
        "committed": str(dto.committed),
        "committed_pct": (
            str(dto.committed_pct) if dto.committed_pct is not None else None
        ),
        "open_cycle_spend": str(dto.open_cycle_spend),
        "invoice": serialize_invoice(dto.invoice),
    }
```

(`CardInvoiceSerializer` existente permanece.)

- [ ] **Step 4: Views**

Substituir `CardViewSet` em `backend/apps/cards/api/views.py`:

```python
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.cards.api.serializers import (
    CardInvoiceSerializer,
    CardSerializer,
    PayInvoiceSerializer,
    serialize_card_summary,
    serialize_invoice,
)
from apps.cards.dtos import CardWriteDTO
from apps.cards.models import Card, CardInvoice
from apps.cards.services import CardInvoiceService, CardService


class CardViewSet(viewsets.ModelViewSet):
    serializer_class = CardSerializer

    def get_queryset(self):
        return Card.objects.filter(user=self.request.user).prefetch_related(
            "payment_methods"
        )

    def _dto(self, data):
        return CardWriteDTO(
            name=data["name"],
            color=data.get("color", "#1a1a1a"),
            closing_day=data["closing_day"],
            due_day=data["due_day"],
            limit=data.get("limit"),
            functions=data.get("functions", []),
        )

    def perform_create(self, serializer):
        card = CardService().create_card(
            self.request.user.id, self._dto(serializer.validated_data)
        )
        serializer.instance = card

    def perform_update(self, serializer):
        data = {**CardSerializer(serializer.instance).data,
                **serializer.validated_data}
        card = CardService().update_card(
            serializer.instance.id, self.request.user.id, self._dto(data)
        )
        serializer.instance = card

    def perform_destroy(self, instance):
        CardService().delete_card(instance.id, self.request.user.id)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        year = int(request.query_params.get("year"))
        month = int(request.query_params.get("month"))
        data = CardInvoiceService().summary(request.user.id, year, month)
        return Response([serialize_card_summary(d) for d in data])

    @action(detail=True, methods=["post"], url_path="pay-invoice")
    def pay_invoice(self, request, pk=None):
        payload = PayInvoiceSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        dto = CardInvoiceService().set_invoice_paid(
            request.user.id,
            int(pk),
            payload.validated_data["year"],
            payload.validated_data["month"],
            payload.validated_data["is_paid"],
        )
        return Response(serialize_invoice(dto))
```

Nota PATCH parcial: `perform_update` mescla dados atuais com os enviados; em PATCH sem `functions`, usar `active_functions` atuais como fallback — `data.get("functions") or CardSerializer(serializer.instance).data["active_functions"]`.

- [ ] **Step 5: Rodar e ver passar + regressão**

Run: `docker compose exec backend uv run pytest apps/cards -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/cards
git commit -m "feat: endpoints summary e pay-invoice; cartao cria formas por funcao"
```

---

### Task 8: API de transações/dívidas — parcelado, recálculo de competência, card_detail (agent-api)

**Files:**
- Modify: `backend/apps/transactions/api/serializers.py`
- Modify: `backend/apps/transactions/api/views.py`
- Modify: `backend/apps/core/api/serializers.py`
- Test: `backend/apps/transactions/tests/api/test_installments_api.py` (mesmo padrão de auth da Task 7)

- [ ] **Step 1: Testes falhando**

```python
# backend/apps/transactions/tests/api/test_installments_api.py
import datetime
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.common.factories import (
    CardFactory,
    CategoryFactory,
    PaymentMethodFactory,
    UserFactory,
)
from apps.core.models import CardFunction
from apps.transactions.models import Debt, Transaction

pytestmark = pytest.mark.django_db


@pytest.fixture
def env():
    user = UserFactory()
    api = APIClient()
    api.force_authenticate(user=user)
    card = CardFactory(user=user, closing_day=3, due_day=10)
    pm = PaymentMethodFactory(user=user, card=card, card_function=CardFunction.CREDIT)
    category = CategoryFactory(user=user)
    return api, user, card, pm, category


def test_post_transaction_with_installments_creates_debt(env):
    api, user, card, pm, category = env
    resp = api.post(
        "/api/v1/transactions/",
        {
            "type": "expense",
            "kind": "variable",
            "description": "Notebook",
            "amount": "1200.00",
            "date": "2026-06-05",
            "category": category.id,
            "payment_method": pm.id,
            "installments": 6,
        },
        format="json",
    )
    assert resp.status_code == 201
    assert Debt.objects.filter(user=user).count() == 1
    assert Transaction.objects.filter(user=user).count() == 6
    assert resp.data["installment_current"] == 1
    assert resp.data["installment_total"] == 6


def test_installments_rejected_for_debit(env):
    api, user, card, pm, category = env
    debit_pm = PaymentMethodFactory(
        user=user, card=card, card_function=CardFunction.DEBIT
    )
    resp = api.post(
        "/api/v1/transactions/",
        {
            "type": "expense",
            "kind": "variable",
            "description": "X",
            "amount": "100.00",
            "date": "2026-06-05",
            "category": category.id,
            "payment_method": debit_pm.id,
            "installments": 3,
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "payment_method" in resp.data["errors"]


def test_patch_payment_method_recalculates_competence(env):
    api, user, card, pm, category = env
    resp = api.post(
        "/api/v1/transactions/",
        {
            "type": "expense", "kind": "variable", "description": "X",
            "amount": "100.00", "date": "2026-06-05",
            "category": category.id,
        },
        format="json",
    )
    tx_id = resp.data["id"]
    assert resp.data["month"] == 6
    resp = api.patch(
        f"/api/v1/transactions/{tx_id}/",
        {"payment_method": pm.id},
        format="json",
    )
    assert resp.data["month"] == 7  # crédito, compra 05/06 fecha dia 3


def test_payment_method_serializer_exposes_card_detail(env):
    api, user, card, pm, category = env
    resp = api.get("/api/v1/payment-methods/")
    item = next(p for p in resp.data["results"] if p["id"] == pm.id)
    assert item["card_function"] == "credit"
    assert item["card_detail"]["closing_day"] == 3
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose exec backend uv run pytest apps/transactions/tests/api/test_installments_api.py -v`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`backend/apps/core/api/serializers.py` — `PaymentMethodSerializer`:

```python
class PaymentMethodSerializer(serializers.ModelSerializer):
    card_detail = serializers.SerializerMethodField()

    class Meta:
        model = PaymentMethod
        fields = [
            "id", "name", "icon", "color", "is_default", "is_archived",
            "card", "card_function", "card_detail",
        ]
        read_only_fields = ["id", "is_default", "card", "card_function",
                            "card_detail"]

    def get_card_detail(self, obj):
        if not obj.card_id:
            return None
        return {
            "id": obj.card_id,
            "name": obj.card.name,
            "color": obj.card.color,
            "closing_day": obj.card.closing_day,
        }
```

(no ViewSet de payment-methods, adicionar `.select_related("card")` ao queryset.)

`backend/apps/transactions/api/serializers.py` — `TransactionSerializer`, adicionar:

```python
    installments = serializers.IntegerField(
        min_value=2, max_value=48, required=False, write_only=True
    )
```

e em `fields`: `"installments", "debt"`; em `read_only_fields`: `"debt"`.

`DebtSerializer`: adicionar `"origin"` a `fields` e `read_only_fields`, e:

```python
    card_detail = serializers.SerializerMethodField()

    def get_card_detail(self, obj):
        pm = obj.payment_method
        if pm and pm.card_id:
            return {"id": pm.card_id, "name": pm.card.name, "color": pm.card.color}
        return None
```

(adicionar `"card_detail"` a fields/read_only; no `DebtViewSet.get_queryset`, `.select_related("payment_method__card")`.)

`backend/apps/transactions/api/views.py` — `TransactionViewSet.perform_create`, antes de montar o DTO:

```python
        installments = data.pop("installments", None)
```

e no final:

```python
        if installments:
            txs = TransactionService().create_installment_purchase(
                dto, installments
            )
            serializer.instance = txs[0]
        else:
            serializer.instance = TransactionService().create(dto)
```

Adicionar `perform_update`:

```python
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
```

`DebtViewSet`: adicionar

```python
    def perform_destroy(self, instance):
        from apps.transactions.services import DebtService

        DebtService().delete(instance.id, self.request.user.id)
```

e bloquear edição de dívida de cartão em `DebtSerializer.validate`:

```python
    def validate(self, data):
        if self.instance and self.instance.origin == "card_purchase":
            raise serializers.ValidationError(
                {"origin": ["Dívida de cartão não é editável; exclua e relance."]}
            )
        return data
```

- [ ] **Step 4: Rodar e ver passar + regressão completa**

Run: `docker compose exec backend uv run pytest -v`
Expected: tudo PASS.

- [ ] **Step 5: Lint + commit**

Run: `docker compose exec backend uv run ruff check . && docker compose exec backend uv run ruff format .`

```bash
git add backend/apps
git commit -m "feat: parcelado via API, recalculo de competencia e card_detail nos serializers"
```

---

### Task 9: Frontend — types + página Cartões (agent-front-pages)

**Files:**
- Modify: `frontend/src/pages/Cards.tsx`
- Regenerar: `frontend/src/types/api.ts` (`npm run generate-types` — nunca editar à mão)

- [ ] **Step 1: Regenerar types**

Run: `docker compose up -d && docker compose exec frontend npm run generate-types`
Expected: types atualizados com `limit`, `functions`, summary etc. Se o script exigir backend acessível, confirmar `docker compose ps` antes.

- [ ] **Step 2: Reescrever Cards.tsx**

Substituições principais (manter layout/classes Tailwind existentes):

1. **Queries**: substituir as duas queries (`cards`, `card-invoices`) por uma:

```tsx
interface InvoiceSummary {
  amount: string
  snapshot_amount: string | null
  is_paid: boolean
  divergent: boolean
  cycle_start: string
  cycle_end: string
  due_date: string
}

interface CardSummary {
  card_id: number
  name: string
  color: string
  closing_day: number
  due_day: number
  functions: string[]
  limit: string | null
  committed: string
  committed_pct: string | null
  open_cycle_spend: string
  invoice: InvoiceSummary
}

const { data: summaries, isLoading } = useQuery<CardSummary[]>({
  queryKey: ['cards-summary', year, month],
  queryFn: () =>
    api
      .get<CardSummary[]>('/cards/summary/', { params: { year, month } })
      .then((r) => r.data),
})
```

2. **Schema do form**:

```tsx
const cardSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  color: z.string().min(1),
  closing_day: z.number().int().min(1).max(31),
  due_day: z.number().int().min(1).max(31),
  limit: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido')
    .optional()
    .or(z.literal('')),
  functions: z
    .array(z.enum(['credit', 'debit']))
    .min(1, 'Escolha ao menos uma função'),
})
```

No `onSubmit`, payload: `{ ...data, limit: data.limit || null }`. Defaults: `functions: ['credit']`.

3. **Campos novos no modal** (após Dia de Vencimento):

```tsx
<div>
  <label className="mb-1.5 block text-xs font-medium text-text-muted">
    Limite (R$, opcional)
  </label>
  <input
    {...register('limit')}
    type="text"
    inputMode="decimal"
    placeholder="0.00"
    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
  />
  {errors.limit && <p className="mt-1 text-xs text-danger">{errors.limit.message}</p>}
</div>

<div>
  <label className="mb-1.5 block text-xs font-medium text-text-muted">Funções</label>
  <div className="flex gap-4">
    {(['credit', 'debit'] as const).map((fn) => (
      <label key={fn} className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          value={fn}
          {...register('functions')}
          className="h-4 w-4 rounded border-border-subtle accent-accent"
        />
        <span className="text-sm text-text-muted">
          {fn === 'credit' ? 'Crédito' : 'Débito'}
        </span>
      </label>
    ))}
  </div>
  {errors.functions && (
    <p className="mt-1 text-xs text-danger">{errors.functions.message}</p>
  )}
</div>
```

4. **Card da grade** — substituir bloco `invoice ? ... : 'Sem fatura para este mês'` por (usando `summary: CardSummary`):

```tsx
{/* Barra de limite */}
{summary.limit && (
  <div className="mb-3">
    <div className="mb-1 flex justify-between text-xs text-text-muted">
      <span>Comprometido</span>
      <span>
        <MoneyText value={summary.committed} /> / <MoneyText value={summary.limit} />
      </span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-elevated">
      <div
        className={`h-full rounded-full transition-all ${
          Number(summary.committed_pct) >= 90
            ? 'bg-danger'
            : Number(summary.committed_pct) >= 70
              ? 'bg-warning'
              : 'bg-accent'
        }`}
        style={{ width: `${Math.min(100, Number(summary.committed_pct))}%` }}
      />
    </div>
  </div>
)}

{/* Fatura do mês */}
<div className="flex items-center justify-between rounded-xl bg-elevated p-3">
  <div>
    <p className="text-xs text-text-muted">
      Fatura · {new Date(summary.invoice.cycle_start + 'T12:00:00').toLocaleDateString('pt-BR')}
      {' – '}
      {new Date(summary.invoice.cycle_end + 'T12:00:00').toLocaleDateString('pt-BR')}
    </p>
    <MoneyText
      value={summary.invoice.is_paid && summary.invoice.snapshot_amount
        ? summary.invoice.snapshot_amount
        : summary.invoice.amount}
      className="font-semibold text-text-primary"
    />
    {summary.invoice.divergent && (
      <span className="ml-2 inline-flex items-center gap-1 rounded-lg bg-warning/10 px-2 py-0.5 text-xs text-warning">
        <AlertTriangle size={11} />
        valor divergente
      </span>
    )}
  </div>
  <button
    onClick={() =>
      payInvoiceMutation.mutate({
        cardId: summary.card_id,
        is_paid: !summary.invoice.is_paid,
      })
    }
    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors"
    style={{
      backgroundColor: summary.invoice.is_paid ? '#34d39920' : '#94a3b820',
      color: summary.invoice.is_paid ? '#34d399' : '#94a3b8',
    }}
  >
    {summary.invoice.is_paid ? (
      <><CheckCircle2 size={12} /> Paga</>
    ) : (
      <><AlertCircle size={12} /> Pendente</>
    )}
  </button>
</div>
```

5. **Mutation pay-invoice** (substitui `markInvoicePaidMutation`):

```tsx
const payInvoiceMutation = useMutation({
  mutationFn: ({ cardId, is_paid }: { cardId: number; is_paid: boolean }) =>
    api.post(`/cards/${cardId}/pay-invoice/`, { year, month, is_paid }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['cards-summary'] })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['debts'] })
    toast('Fatura atualizada', 'success')
  },
  onError: () => toast('Erro ao atualizar fatura', 'error'),
})
```

6. **Create/edit/delete** continuam em `/cards/`, mas `openEdit` preenche também `limit` (string ou `''`) e `functions` (do summary). Invalidar `['cards-summary']` nos `onSuccess`.

7. Importar `AlertTriangle` de lucide-react. Remover import de tipos antigos `Card`/`CardInvoice` se não usados.

- [ ] **Step 3: Build**

Run: `docker compose exec frontend npm run build`
Expected: build sem erros TS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat: pagina Cartoes com limite, barra de comprometido e fatura automatica"
```

---

### Task 10: Frontend — Lançamentos com crédito/parcelado (agent-front-pages)

**Files:**
- Create: `frontend/src/lib/cardCycle.ts`
- Create: `frontend/src/lib/cardCycle.test.ts`
- Modify: `frontend/src/pages/Transactions.tsx`

- [ ] **Step 1: Teste falhando do helper**

```ts
// frontend/src/lib/cardCycle.test.ts
import { describe, expect, it } from 'vitest'
import { invoiceMonthLabel } from './cardCycle'

describe('invoiceMonthLabel', () => {
  it('compra após fechamento vai para o mês seguinte', () => {
    expect(invoiceMonthLabel(3, '2026-06-05')).toBe('julho')
  })
  it('compra até o fechamento fica no mês', () => {
    expect(invoiceMonthLabel(3, '2026-06-02')).toBe('junho')
  })
  it('vira o ano', () => {
    expect(invoiceMonthLabel(3, '2026-12-15')).toBe('janeiro')
  })
})
```

Run: `docker compose exec frontend npm run test -- --run src/lib/cardCycle.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 2: Implementar helper**

```ts
// frontend/src/lib/cardCycle.ts
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** Mês da fatura (competência) de uma compra crédito. Espelha apps/cards/cycle.py. */
export function invoiceMonthLabel(closingDay: number, dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const closing = Math.min(closingDay, lastDay)
  const monthIndex = day <= closing ? month - 1 : month % 12
  return MONTHS[monthIndex]
}
```

Run: `docker compose exec frontend npm run test -- --run src/lib/cardCycle.test.ts`
Expected: 3 PASS.

- [ ] **Step 3: Modificar Transactions.tsx**

1. Schema — adicionar:

```tsx
  installments: z.number().int().min(2).max(48).optional(),
```

2. Estado derivado após `const txType = watch('type')`:

```tsx
const selectedPmId = watch('payment_method')
const selectedPm = paymentMethods?.results.find((p) => p.id === selectedPmId)
const isCredit = selectedPm?.card_function === 'credit'
const watchedDate = watch('date')
const [isInstallment, setIsInstallment] = useState(false)
```

3. No `<select>` de Forma de Pagamento, trocar o texto da option por:

```tsx
<option key={p.id} value={p.id}>
  {p.name}
  {p.card_function === 'credit' ? ' · Crédito' : p.card_function === 'debit' ? ' · Débito' : ''}
</option>
```

4. Logo abaixo do grid Categoria/Forma, adicionar bloco condicional:

```tsx
{txType === 'expense' && isCredit && (
  <div className="space-y-3 rounded-xl border border-accent/20 bg-accent/5 p-3">
    {watchedDate && selectedPm?.card_detail && (
      <p className="text-xs text-accent">
        Entra na fatura de{' '}
        {invoiceMonthLabel(selectedPm.card_detail.closing_day, watchedDate)}
      </p>
    )}
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={isInstallment}
        onChange={(e) => {
          setIsInstallment(e.target.checked)
          if (!e.target.checked) setValue('installments', undefined)
        }}
        className="h-4 w-4 rounded border-border-subtle accent-accent"
      />
      <span className="text-sm text-text-muted">Parcelado?</span>
    </label>
    {isInstallment && (
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-muted">
          Nº de parcelas (valor total acima)
        </label>
        <input
          {...register('installments', { valueAsNumber: true })}
          type="number"
          min={2}
          max={48}
          className="w-24 rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
        />
        {errors.installments && (
          <p className="mt-1 text-xs text-danger">{errors.installments.message}</p>
        )}
      </div>
    )}
  </div>
)}
```

5. `onSubmit`: `if (!payload.installments) delete payload.installments`. Reset de `isInstallment` ao fechar modal. Import `invoiceMonthLabel` de `@/lib/cardCycle`.

6. Tipo `PaymentMethod` (gerado) já traz `card_function`/`card_detail` após Task 9 Step 1; se generate-types não expôs, regenerar.

- [ ] **Step 4: Build + commit**

Run: `docker compose exec frontend npm run build`
Expected: sem erros.

```bash
git add frontend/src
git commit -m "feat: lancamento credito com aviso de fatura e compra parcelada"
```

---

### Task 11: Frontend — Dívidas com badge de cartão (agent-front-pages)

**Files:**
- Modify: `frontend/src/pages/Debts.tsx`

- [ ] **Step 1: Modificar**

1. Após o nome do credor (`<p className="font-semibold...">{debt.creditor}</p>`), badge do cartão:

```tsx
{debt.card_detail && (
  <span
    className="rounded-full px-2 py-0.5 text-xs"
    style={{
      backgroundColor: `${debt.card_detail.color}20`,
      color: debt.card_detail.color,
    }}
  >
    {debt.card_detail.name}
  </span>
)}
```

2. Esconder "Avançar Parcela" para dívidas de cartão — trocar condição:

```tsx
{!debt.is_settled && debt.origin !== 'card_purchase' && (
```

3. Para `origin === 'card_purchase'`, no lugar do botão:

```tsx
{debt.origin === 'card_purchase' && !debt.is_settled && (
  <span className="text-xs text-text-muted">avança ao pagar fatura</span>
)}
```

4. Tipo `Debt` gerado já traz `origin`/`card_detail` (Task 8 + generate-types).

- [ ] **Step 2: Build + commit**

Run: `docker compose exec frontend npm run build`
Expected: sem erros.

```bash
git add frontend/src
git commit -m "feat: dividas de cartao com badge e progresso automatico"
```

---

### Task 12: Gate de qualidade final (orquestrador)

- [ ] **Step 1: Backend completo**

Run: `docker compose exec backend uv run pytest --cov=apps --cov-fail-under=85`
Expected: PASS, cobertura ≥ 85%.

- [ ] **Step 2: Lint + types**

Run: `docker compose exec backend uv run ruff check . && docker compose exec backend uv run mypy apps/`
Expected: limpo (mypy strict em domain).

- [ ] **Step 3: Frontend**

Run: `docker compose exec frontend npm run test -- --run && docker compose exec frontend npm run build`
Expected: PASS.

- [ ] **Step 4: Smoke manual**

Subir stack, criar cartão crédito com limite, lançar compra à vista + parcelada 3×, navegar meses no MonthPicker (parcelas visíveis), pagar fatura, conferir dívida avançou e barra de limite caiu.

- [ ] **Step 5: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "chore: ajustes finais cartoes integrados"
```
