import calendar
import datetime
from decimal import ROUND_FLOOR, Decimal
from typing import Any

from django.db import transaction as db_transaction

from apps.cards.cycle import add_months, competence_for_purchase
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
        category_id = (
            None if dto.type == TransactionType.INCOME else dto.category_id
        )

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
            txs: list[Transaction] = []
            for number in range(1, installments + 1):
                year, month = add_months(base_year, base_month, number - 1)
                amount = (
                    last_installment
                    if number == installments
                    else per_installment
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

    def get_summary(
        self, user_id: int, year: int, month: int
    ) -> MonthSummaryDTO:
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
