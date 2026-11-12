import calendar
import datetime
import hashlib
import re
from decimal import ROUND_FLOOR, Decimal
from types import SimpleNamespace
from typing import Any

from django.db import transaction as db_transaction

from apps.cards.cycle import add_months, competence_for_purchase
from apps.cards.repositories import CardPaymentMethodRepository, CardRepository
from apps.common.dtos import (
    CreateTransactionDTO,
    GenerationResultDTO,
    MonthSummaryDTO,
    PendingVariableDTO,
)
from apps.core.models import CardFunction
from apps.core.repositories import (  # noqa: F401
    CategoryRepository,
    PaymentMethodRepository,
)
from apps.investments.repositories import InvestmentRepository
from apps.transactions.classifier import classify
from apps.transactions.importers import ParsedRow, parse_statement
from apps.transactions.models import (
    DebtOrigin,
    RecurringStatus,
    Transaction,
    TransactionKind,
    TransactionType,
)
from apps.transactions.repositories import (
    DebtRepository,
    RecurringExpenseRepository,
    TransactionRepository,
)


class RecurringExpenseService:
    def __init__(
        self,
        recurring_repo: RecurringExpenseRepository | None = None,
        transaction_repo: TransactionRepository | None = None,
    ) -> None:
        self._recurring = recurring_repo or RecurringExpenseRepository()
        self._tx = transaction_repo or TransactionRepository()

    def generate_for_month(
        self, user_id: int, year: int, month: int
    ) -> GenerationResultDTO:
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

    def ensure_month(self, user_id: int, year: int, month: int) -> int:
        """R1: gera (idempotente) os fixos do mês. Retorna quantos criou."""
        created = 0
        for template in self._recurring.list_active(user_id):
            if template.start_date and (year, month) < (
                template.start_date.year,
                template.start_date.month,
            ):
                continue
            if template.default_amount is None:
                continue
            if self._recurring.exists_transaction_for_month(
                template.id, user_id, year, month
            ):
                continue
            day = min(template.due_day, calendar.monthrange(year, month)[1])
            self._tx.create(
                {
                    "user_id": user_id,
                    "type": template.type,
                    "kind": TransactionKind.FIXED,
                    "category_id": template.category_id,
                    "payment_method_id": template.payment_method_id,
                    "description": template.description,
                    "amount": template.default_amount,
                    "date": datetime.date(year, month, day),
                    "year": year,
                    "month": month,
                    "is_paid": template.type == TransactionType.INCOME,
                    "recurring_source_id": template.id,
                }
            )
            created += 1
        return created

    def delete_template(
        self, template_id: int, user_id: int, today: datetime.date
    ) -> None:
        """Exclui o template e as transações não pagas de meses futuros."""
        template = self._recurring.get_by_id(template_id, user_id)
        with db_transaction.atomic():
            self._recurring.delete_future_unpaid(template, today.year, today.month)
            template.delete()  # transações restantes ficam (SET_NULL)

    def propagate(self, tx: Transaction, fields: dict[str, Any]) -> None:
        """R2: amount/description/category_id do fixo vão ao template e às
        transações posteriores não pagas."""
        template = self._recurring.get_by_id(tx.recurring_source_id, tx.user_id)
        template_fields = {
            ("default_amount" if k == "amount" else k): v for k, v in fields.items()
        }
        for k, v in template_fields.items():
            setattr(template, k, v)
        template.save(update_fields=[*template_fields, "updated_at"])
        self._tx.update_later_unpaid(tx, fields)

    def generate_variables(
        self,
        user_id: int,
        year: int,
        month: int,
        overrides: list[dict[str, Any]],
    ) -> GenerationResultDTO:
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


class TransactionService:
    def __init__(self, transaction_repo: TransactionRepository | None = None) -> None:
        self._tx = transaction_repo or TransactionRepository()

    def resolve_competence(
        self,
        user_id: int,
        payment_method_id: int | None,
        date: datetime.date,
    ) -> tuple[int, int]:
        if payment_method_id:
            pm = PaymentMethodRepository.get_with_card(payment_method_id, user_id)
            if pm.card_function == CardFunction.CREDIT and pm.card is not None:
                return competence_for_purchase(pm.card.closing_day, date)
        return date.year, date.month

    def create(self, dto: CreateTransactionDTO) -> Transaction:
        errors: dict[str, list[str]] = {}

        if dto.type == TransactionType.EXPENSE and not dto.category_id:
            errors["category"] = ["Categoria é obrigatória para despesas."]

        if dto.amount <= Decimal("0"):
            errors["amount"] = ["Valor deve ser maior que zero."]

        if errors:
            from apps.common.exceptions import ValidationDomainError

            raise ValidationDomainError(errors)

        is_paid = True if dto.type == TransactionType.INCOME else dto.is_paid
        category_id = None if dto.type == TransactionType.INCOME else dto.category_id

        year, month = self.resolve_competence(
            dto.user_id, dto.payment_method_id, dto.date
        )

        return self._tx.create(
            {
                "user_id": dto.user_id,
                "type": dto.type,
                "kind": dto.kind,
                "category_id": category_id,
                "payment_method_id": dto.payment_method_id,
                "description": dto.description,
                "amount": dto.amount,
                "date": dto.date,
                "year": year,
                "month": month,
                "is_paid": is_paid,
                "recurring_source_id": dto.recurring_source_id,
                "installment_current": dto.installment_current,
                "installment_total": dto.installment_total,
                "import_key": dto.import_key,
            }
        )

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
            if pm.card is None or pm.card_function != CardFunction.CREDIT:
                errors["payment_method"] = [
                    "Parcelamento só é permitido em cartão de crédito."
                ]

        if errors or pm is None or pm.card is None:
            raise ValidationDomainError(errors)

        per_installment = (dto.amount / installments).quantize(
            Decimal("0.01"), rounding=ROUND_FLOOR
        )
        last_installment = dto.amount - per_installment * (installments - 1)
        base_year, base_month = competence_for_purchase(pm.card.closing_day, dto.date)

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
            txs: list[Transaction] = []
            for number in range(1, installments + 1):
                year, month = add_months(base_year, base_month, number - 1)
                amount = last_installment if number == installments else per_installment
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

    def update(self, tx_id: int, user_id: int, data: dict[str, Any]) -> Transaction:
        """Atualiza campos editáveis. R2: amount/description/category_id de fixo
        propagam ao template e às transações posteriores não pagas."""
        from apps.common.exceptions import ValidationDomainError

        tx = self._tx.get_by_id(tx_id, user_id)
        if "amount" in data:
            amount = Decimal(str(data["amount"]))
            if amount <= Decimal("0"):
                raise ValidationDomainError(
                    {"amount": ["Valor deve ser maior que zero."]}
                )
            data = {**data, "amount": amount}
        for field in (
            "description",
            "amount",
            "date",
            "category_id",
            "payment_method_id",
            "is_paid",
        ):
            if field in data:
                setattr(tx, field, data[field])
        if tx.recurring_source_id is None and (
            "date" in data or "payment_method_id" in data
        ):
            tx.year, tx.month = self.resolve_competence(
                user_id, tx.payment_method_id, tx.date
            )
        with db_transaction.atomic():
            tx.save()
            propagated = {
                k: data[k]
                for k in ("amount", "description", "category_id")
                if k in data
            }
            if propagated and tx.recurring_source_id is not None:
                RecurringExpenseService(transaction_repo=self._tx).propagate(
                    tx, propagated
                )
        return tx

    def toggle_paid(self, tx_id: int, user_id: int) -> Transaction:
        tx = self._tx.get_by_id(tx_id, user_id)
        if tx.type == TransactionType.INCOME:
            from apps.common.exceptions import DomainError

            raise DomainError("Income transactions are always paid.")
        tx.is_paid = not tx.is_paid
        tx.save()
        return tx

    def delete(self, tx_id: int, user_id: int) -> None:
        tx = self._tx.get_by_id(tx_id, user_id)
        tx.delete()


class DebtService:
    def delete(self, debt_id: int, user_id: int) -> None:
        debt = DebtRepository.get_by_id(debt_id, user_id)
        with db_transaction.atomic():
            if debt.origin == DebtOrigin.CARD_PURCHASE:
                DebtRepository.delete_card_debt(debt)
            else:
                debt.delete()


class MonthSummaryService:
    def __init__(
        self,
        transaction_repo: TransactionRepository | None = None,
        investment_repo: InvestmentRepository | None = None,
    ) -> None:
        self._tx = transaction_repo or TransactionRepository()
        self._inv = investment_repo or InvestmentRepository()

    def get_summary(self, user_id: int, year: int, month: int) -> MonthSummaryDTO:
        total_income = self._tx.sum_by_type(
            user_id, year, month, TransactionType.INCOME
        )
        total_expense = self._tx.sum_by_type(
            user_id, year, month, TransactionType.EXPENSE
        )
        total_fixed = self._tx.sum_by_kind(
            user_id, year, month, TransactionType.EXPENSE, TransactionKind.FIXED
        )
        total_variable = self._tx.sum_by_kind(
            user_id, year, month, TransactionType.EXPENSE, TransactionKind.VARIABLE
        )
        total_invested = self._inv.sum_by_month(user_id, year, month)
        balance = total_income - total_expense - total_invested
        pending_count = self._tx.pending_count(user_id, year, month)
        investment_goal = self._inv.get_goal(user_id, year, month)
        by_category = self._tx.sum_by_category(user_id, year, month)
        by_payment_method = self._tx.sum_by_payment_method(user_id, year, month)

        return MonthSummaryDTO(
            year=year,
            month=month,
            total_income=total_income,
            total_expense=total_expense,
            total_fixed=total_fixed,
            total_variable=total_variable,
            total_invested=total_invested,
            balance=balance,
            pending_count=pending_count,
            investment_goal=investment_goal,
            by_category=by_category,
            by_payment_method=by_payment_method,
        )


_IGNORE_RE = re.compile(
    r"pagamento (de )?fatura|pagamento on.?line|pagamento recebido|"
    r"pgto fatura|fatura (do )?cart|pagamento efetuado|estorno de pagamento",
    re.IGNORECASE,
)
# (regex, nome da categoria) — primeira que casar vence
_KEYWORD_CATEGORIES = [
    (r"\buber\b|\b99\b|99\s?pop|posto|combust", "Uber/transporte"),
    (r"ifood|restaurante|lanchonete|padaria", "Alimentação"),
    (r"mercado|supermerc", "Mercado"),
    (r"farmac|drogar", "Saúde"),
    (r"spotify|netflix|prime|youtube", "Assinaturas"),
]


def _keyword_category(description: str) -> str | None:
    return next(
        (
            name
            for pattern, name in _KEYWORD_CATEGORIES
            if re.search(pattern, description, re.IGNORECASE)
        ),
        None,
    )


class StatementImportService:
    """R5/R6: importa fatura/extrato (Inter, Nubank, OFX) como transações."""

    def __init__(
        self,
        transaction_repo: TransactionRepository | None = None,
        recurring_service: RecurringExpenseService | None = None,
    ) -> None:
        self._tx = transaction_repo or TransactionRepository()
        self._recurring = recurring_service or RecurringExpenseService()

    def import_file(
        self,
        user_id: int,
        file_bytes: bytes,
        filename: str,
        card_id: int,
        kind: str,
        year: int | None = None,
        month: int | None = None,
        categories: dict[int, int | None] | None = None,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        from apps.common.exceptions import ValidationDomainError

        chosen = categories or {}
        if kind not in (CardFunction.CREDIT, CardFunction.DEBIT):
            raise ValidationDomainError({"kind": ["Use 'credit' ou 'debit'."]})
        if kind == CardFunction.CREDIT and not (year and month):
            raise ValidationDomainError(
                {"year": ["Mês da fatura é obrigatório para crédito."]}
            )
        card = CardRepository.get_by_id(card_id, user_id)
        if not card.is_active:
            raise ValidationDomainError({"card": ["Cartão inativo."]})
        rows = parse_statement(file_bytes, filename)
        user_cats = CategoryRepository.list_by_user(user_id)
        by_id = {c.id: c for c in user_cats}
        if any(cid is not None and cid not in by_id for cid in chosen.values()):
            raise ValidationDomainError({"categories": ["Categoria inválida."]})
        categories = {c.name.lower(): c for c in user_cats}

        refunded = self._pair_refunds(rows) if kind == CardFunction.CREDIT else set()
        # LLM só para despesas sem palavra-chave; uma chamada por importação.
        to_classify = list(
            dict.fromkeys(
                r.description
                for i, r in enumerate(rows)
                if r.outflow
                and i not in chosen
                and i not in refunded
                and not _IGNORE_RE.search(r.description)
                and _keyword_category(r.description) is None
            )
        )
        llm = dict(
            zip(
                to_classify,
                classify(to_classify, [c.name for c in categories.values()]),
                strict=True,
            )
        )

        keys = self._keys(card_id, rows)
        existing = self._tx.existing_import_keys(user_id, keys)
        fixed_cache: dict[tuple[int, int], list[Transaction]] = {}
        items: list[dict[str, Any]] = []
        created = skipped = 0
        total = Decimal("0")

        with db_transaction.atomic():
            pm = CardPaymentMethodRepository.get_or_create_function(card, kind)
            for idx, (row, key) in enumerate(zip(rows, keys, strict=True)):
                comp = (
                    (year, month)
                    if kind == CardFunction.CREDIT
                    else (
                        row.date.year,
                        row.date.month,
                    )
                )
                tx_type = (
                    TransactionType.EXPENSE if row.outflow else TransactionType.INCOME
                )
                item = {
                    "date": row.date.isoformat(),
                    "description": row.description,
                    "amount": str(row.amount.quantize(Decimal("0.01"))),
                    "index": idx,
                    "category": None,
                    "category_id": None,
                    "status": "created",
                }
                if idx in refunded:
                    item["status"] = "refunded"
                elif _IGNORE_RE.search(row.description) or (
                    kind == CardFunction.CREDIT and not row.outflow
                ):
                    item["status"] = "ignored"
                elif key in existing or self._matches_fixed(
                    user_id, comp, tx_type, row, fixed_cache
                ):
                    item["status"] = "duplicate"
                else:
                    if chosen.get(idx) is not None:
                        category = by_id[chosen[idx]]
                    elif tx_type == TransactionType.INCOME:
                        category = None
                    else:
                        # null em `categories` = fallback "Outros", sem LLM
                        category = self._category_for(
                            row, categories, user_id, llm, idx in chosen, dry_run
                        )
                    item["category"] = category.name if category else None
                    item["category_id"] = category.id if category else None
                    self._tx.create(
                        {
                            "user_id": user_id,
                            "type": tx_type,
                            "kind": TransactionKind.VARIABLE,
                            "category_id": category.id if category else None,
                            "payment_method_id": pm.id,
                            "description": row.description[:100],
                            "amount": row.amount,
                            "date": row.date,
                            "year": comp[0],
                            "month": comp[1],
                            "is_paid": kind == CardFunction.DEBIT
                            or tx_type == TransactionType.INCOME,
                            "import_key": key,
                            "installment_current": row.installment_current,
                            "installment_total": row.installment_total,
                        }
                    )
                    created += 1
                    total += row.amount
                if item["status"] != "created":
                    skipped += 1
                items.append(item)
            if dry_run:
                db_transaction.set_rollback(True)

        return {
            "created": created,
            "skipped": skipped,
            "total": str(total.quantize(Decimal("0.01"))),
            "items": items,
        }

    @staticmethod
    def _pair_refunds(rows: list[ParsedRow]) -> set[int]:
        """Estorno (inflow que não é pagamento) anula compra de mesmo valor e
        descrição, preferindo a de data mais próxima. Retorna índices pareados."""
        paired: set[int] = set()
        for i, r in enumerate(rows):
            if r.outflow or _IGNORE_RE.search(r.description):
                continue
            desc = r.description.strip().lower()
            candidates = [
                j
                for j, p in enumerate(rows)
                if p.outflow
                and j not in paired
                and p.amount == r.amount
                and p.description.strip().lower() == desc
            ]
            if candidates:
                j = min(candidates, key=lambda j: abs((rows[j].date - r.date).days))
                paired |= {i, j}
        return paired

    @staticmethod
    def _keys(card_id: int, rows: list[ParsedRow]) -> list[str]:
        seen: dict[tuple[str, str, str], int] = {}
        keys = []
        for r in rows:
            base = (r.date.isoformat(), r.description, f"{r.amount:.2f}")
            idx = seen.get(base, 0)
            seen[base] = idx + 1
            raw = f"{card_id}|{'|'.join(base)}|{r.outflow}|{idx}"
            keys.append(hashlib.sha1(raw.encode()).hexdigest())  # noqa: S324
        return keys

    def _matches_fixed(
        self,
        user_id: int,
        comp: tuple[int, int],
        tx_type: str,
        row: ParsedRow,
        cache: dict[tuple[int, int], list[Transaction]],
    ) -> bool:
        if comp not in cache:
            self._recurring.ensure_month(user_id, *comp)
            cache[comp] = self._tx.fixed_in_month(user_id, *comp)
        for fixed in cache[comp]:
            if fixed.type == tx_type and fixed.amount == row.amount:
                cache[comp].remove(fixed)  # cada fixo casa com um único item
                return True
        return False

    @staticmethod
    def _category_for(
        row: ParsedRow,
        categories: dict[str, Any],
        user_id: int,
        llm: dict[str, str | None],
        fallback_only: bool = False,
        dry_run: bool = False,
    ) -> Any:
        wanted = None
        if not fallback_only:
            wanted = _keyword_category(row.description) or llm.get(row.description)
            if wanted is None and row.bank_category:
                wanted = row.bank_category
        cat = categories.get((wanted or "").lower()) or categories.get("outros")
        if cat is None:
            if dry_run:  # prévia nunca materializa "Outros"
                return SimpleNamespace(id=None, name="Outros")
            cat = CategoryRepository.create_named(user_id, "Outros")
            categories["outros"] = cat
        return cat
