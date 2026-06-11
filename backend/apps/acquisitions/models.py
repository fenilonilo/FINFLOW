from django.db import models

from apps.accounts.models import User
from apps.core.models import Category


class AcquisitionType(models.TextChoices):
    CASH = "cash"
    INSTALLMENT = "installment"
    FINANCING = "financing"
    CONSORTIUM = "consortium"


class AmortizationSystem(models.TextChoices):
    PRICE = "price"
    SAC = "sac"
    NONE = "none"


class AcquisitionStatus(models.TextChoices):
    SIMULATION = "simulation"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Acquisition(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="acquisitions"
    )
    name = models.CharField(max_length=100)
    total_value = models.DecimalField(max_digits=12, decimal_places=2)
    acquisition_type = models.CharField(max_length=15, choices=AcquisitionType.choices)
    down_payment = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    installments_count = models.PositiveSmallIntegerField(null=True, blank=True)
    monthly_interest_rate = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True
    )
    amortization_system = models.CharField(
        max_length=10,
        choices=AmortizationSystem.choices,
        default=AmortizationSystem.NONE,
    )
    extra_monthly_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    start_date = models.DateField()
    status = models.CharField(
        max_length=15,
        choices=AcquisitionStatus.choices,
        default=AcquisitionStatus.SIMULATION,
    )
    category = models.ForeignKey(
        Category, null=True, blank=True, on_delete=models.SET_NULL
    )
    recurring_expense = models.OneToOneField(
        "transactions.RecurringExpense",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="acquisition_source",
    )
    result_snapshot = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "acquisitions_acquisition"


class AcquisitionInstallment(models.Model):
    acquisition = models.ForeignKey(
        Acquisition, on_delete=models.CASCADE, related_name="installments"
    )
    number = models.PositiveSmallIntegerField()
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    interest_portion = models.DecimalField(max_digits=12, decimal_places=2)
    principal_portion = models.DecimalField(max_digits=12, decimal_places=2)
    remaining_balance = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "acquisitions_acquisitioninstallment"
        ordering = ["number"]
