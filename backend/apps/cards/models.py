from django.db import models

from apps.accounts.models import User


class Card(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="cards")
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=7, default="#1a1a1a")
    closing_day = models.PositiveSmallIntegerField()
    due_day = models.PositiveSmallIntegerField()
    limit = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cards_card"


class CardInvoice(models.Model):
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name="invoices")
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    due_date = models.DateField()
    is_paid = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cards_cardinvoice"
        constraints = [
            models.UniqueConstraint(
                fields=["card", "year", "month"],
                name="unique_invoice_per_card_month",
            )
        ]
