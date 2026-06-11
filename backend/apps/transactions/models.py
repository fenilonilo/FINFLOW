from typing import Any

from django.db import models

from apps.accounts.models import User
from apps.core.models import Category, PaymentMethod


class TransactionType(models.TextChoices):
    INCOME = "income"
    EXPENSE = "expense"


class TransactionKind(models.TextChoices):
    FIXED = "fixed"
    VARIABLE = "variable"


class RecurringStatus(models.TextChoices):
    ACTIVE = "active"
    PAUSED = "paused"


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
    default_amount = models.DecimalField(max_digits=12, decimal_places=2)
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


class Transaction(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="transactions"
    )
    type = models.CharField(max_length=10, choices=TransactionType.choices)
    kind = models.CharField(max_length=10, choices=TransactionKind.choices)
    category = models.ForeignKey(
        Category, null=True, blank=True, on_delete=models.SET_NULL
    )
    description = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    payment_method = models.ForeignKey(
        PaymentMethod, null=True, blank=True, on_delete=models.SET_NULL
    )
    is_paid = models.BooleanField(default=False)
    recurring_source = models.ForeignKey(
        RecurringExpense,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="transactions",
    )
    installment_current = models.PositiveSmallIntegerField(null=True, blank=True)
    installment_total = models.PositiveSmallIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transactions_transaction"
        indexes = [
            models.Index(
                fields=["user", "year", "month"],
                name="tx_user_year_month_idx",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "recurring_source", "year", "month"],
                condition=models.Q(recurring_source__isnull=False),
                name="unique_transaction_recurring_per_month",
            )
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.year = self.date.year
        self.month = self.date.month
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.description} ({self.date})"


class Debt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="debts")
    debt_type = models.CharField(max_length=20, default="installment")
    creditor = models.CharField(max_length=100)
    payment_method = models.ForeignKey(
        PaymentMethod, null=True, blank=True, on_delete=models.SET_NULL
    )
    installment_current = models.PositiveSmallIntegerField()
    installment_total = models.PositiveSmallIntegerField()
    installment_amount = models.DecimalField(max_digits=12, decimal_places=2)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    start_date = models.DateField()
    is_settled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transactions_debt"
