import calendar
import datetime
from decimal import Decimal

from apps.common.dtos import (
    CreateTransactionDTO,
    GenerationResultDTO,
    MonthSummaryDTO,
)
from apps.core.repositories import CategoryRepository  # noqa: F401
from apps.investments.repositories import InvestmentRepository
from apps.transactions.models import (
    RecurringStatus,
    Transaction,
    TransactionKind,
    TransactionType,
)
from apps.transactions.repositories import (
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

        for template in templates:
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
            created=created, skipped=skipped, completed_templates=completed
        )


class TransactionService:
    def __init__(self, transaction_repo: TransactionRepository | None = None) -> None:
        self._tx = transaction_repo or TransactionRepository()

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
                "year": dto.date.year,
                "month": dto.date.month,
                "is_paid": is_paid,
                "recurring_source_id": dto.recurring_source_id,
                "installment_current": dto.installment_current,
                "installment_total": dto.installment_total,
            }
        )

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
