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


class CardFunction(models.TextChoices):
    CREDIT = "credit"
    DEBIT = "debit"


class PaymentMethod(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="payment_methods"
    )
    name = models.CharField(max_length=40)
    icon = models.CharField(max_length=30, default="credit-card")
    color = models.CharField(max_length=7, default="#94a3b8")
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
            ),
            models.UniqueConstraint(
                fields=["card", "card_function"],
                condition=models.Q(card__isnull=False),
                name="unique_card_function_per_card",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(card__isnull=True, card_function__isnull=True)
                    | models.Q(card__isnull=False, card_function__isnull=False)
                ),
                name="card_and_function_together",
            ),
        ]

    def __str__(self) -> str:
        return self.name
