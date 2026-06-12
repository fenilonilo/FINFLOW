from decimal import Decimal

from rest_framework import serializers

from apps.core.api.serializers import CategorySerializer, PaymentMethodSerializer
from apps.transactions.models import Debt, RecurringExpense, Transaction


def _serialize_summary(summary):
    return {
        "year": summary.year,
        "month": summary.month,
        "total_income": str(summary.total_income),
        "total_expense": str(summary.total_expense),
        "total_fixed": str(summary.total_fixed),
        "total_variable": str(summary.total_variable),
        "total_invested": str(summary.total_invested),
        "balance": str(summary.balance),
        "pending_count": summary.pending_count,
        "investment_goal": str(summary.investment_goal),
        "by_category": [
            {
                "category_id": c["category_id"],
                "category_name": c["category__name"],
                "color": c["category__color"],
                "total": str(c["total"]),
                "budget": str(c.get("budget") or "0.00"),
                "budget_used_pct": str(
                    round(c["total"] / c["budget"] * 100, 2)
                    if c.get("budget")
                    else "0.00"
                ),
            }
            for c in summary.by_category
        ],
        "by_payment_method": [
            {
                "payment_method_id": p["payment_method_id"],
                "name": p["payment_method__name"],
                "total": str(p["total"]),
            }
            for p in summary.by_payment_method
        ],
    }


class TransactionSerializer(serializers.ModelSerializer):
    category_detail = CategorySerializer(source="category", read_only=True)
    payment_method_detail = PaymentMethodSerializer(
        source="payment_method", read_only=True
    )
    installments = serializers.IntegerField(
        min_value=2, max_value=48, required=False, write_only=True
    )

    class Meta:
        model = Transaction
        fields = [
            "id",
            "type",
            "kind",
            "category",
            "category_detail",
            "description",
            "amount",
            "date",
            "year",
            "month",
            "payment_method",
            "payment_method_detail",
            "is_paid",
            "recurring_source",
            "installment_current",
            "installment_total",
            "debt",
            "installments",
        ]
        read_only_fields = [
            "id",
            "year",
            "month",
            "category_detail",
            "payment_method_detail",
            "debt",
        ]


class RecurringExpenseSerializer(serializers.ModelSerializer):
    category_detail = CategorySerializer(source="category", read_only=True)
    payment_method_detail = PaymentMethodSerializer(
        source="payment_method", read_only=True
    )

    class Meta:
        model = RecurringExpense
        fields = [
            "id",
            "description",
            "is_variable",
            "category",
            "category_detail",
            "payment_method",
            "payment_method_detail",
            "default_amount",
            "due_day",
            "status",
            "total_occurrences",
            "generated_count",
            "acquisition",
        ]
        read_only_fields = ["id", "generated_count"]

    def validate(self, data):
        is_variable = data.get(
            "is_variable", getattr(self.instance, "is_variable", False)
        )
        default_amount = data.get(
            "default_amount", getattr(self.instance, "default_amount", None)
        )
        if not is_variable and not default_amount:
            raise serializers.ValidationError(
                {"default_amount": ["Valor obrigatório para gastos de valor fixo."]}
            )
        return data


class GenerateVariableItemSerializer(serializers.Serializer):
    recurring_id = serializers.IntegerField()
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )


class DebtSerializer(serializers.ModelSerializer):
    card_detail = serializers.SerializerMethodField()

    class Meta:
        model = Debt
        fields = [
            "id",
            "debt_type",
            "origin",
            "creditor",
            "payment_method",
            "installment_current",
            "installment_total",
            "installment_amount",
            "total_amount",
            "start_date",
            "is_settled",
            "card_detail",
        ]
        read_only_fields = ["id", "origin", "card_detail"]

    def get_card_detail(self, obj):
        pm = obj.payment_method
        if pm and pm.card_id:
            return {
                "id": pm.card_id,
                "name": pm.card.name,
                "color": pm.card.color,
            }
        return None

    def validate(self, data):
        if self.instance and getattr(self.instance, "origin", None) == "card_purchase":
            raise serializers.ValidationError(
                {"origin": ["Dívida de cartão não é editável; exclua e relance."]}
            )
        return data
