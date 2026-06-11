from django.db import models

from apps.accounts.models import User


class Category(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=50)
    icon = models.CharField(max_length=30, default="circle")
    color = models.CharField(max_length=7, default="#94a3b8")
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children",
    )
    monthly_budget = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    is_default = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_category"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name"],
                name="unique_user_category_name",
            )
        ]

    def __str__(self) -> str:
        return self.name


class PaymentMethod(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="payment_methods"
    )
    name = models.CharField(max_length=40)
    icon = models.CharField(max_length=30, default="credit-card")
    color = models.CharField(max_length=7, default="#94a3b8")
    is_default = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_paymentmethod"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name"],
                name="unique_user_payment_method_name",
            )
        ]

    def __str__(self) -> str:
        return self.name
