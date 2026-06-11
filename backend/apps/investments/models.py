from django.db import models

from apps.accounts.models import User


class InvestmentGoal(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="investment_goals"
    )
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "investments_investmentgoal"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "year", "month"],
                name="unique_investment_goal_per_month",
            )
        ]


class Investment(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="investments"
    )
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    date = models.DateField()
    location = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "investments_investment"
