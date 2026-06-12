from rest_framework import serializers

from apps.cards.models import Card, CardInvoice
from apps.core.models import CardFunction


class CardSerializer(serializers.ModelSerializer):
    functions = serializers.ListField(
        child=serializers.ChoiceField(choices=CardFunction.choices),
        write_only=True,
        required=True,
    )
    active_functions = serializers.SerializerMethodField()

    class Meta:
        model = Card
        fields = [
            "id", "name", "color", "closing_day", "due_day",
            "limit", "functions", "active_functions",
        ]
        read_only_fields = ["id", "active_functions"]

    def get_active_functions(self, obj):
        return [
            pm.card_function
            for pm in obj.payment_methods.all()
            if not pm.is_archived
        ]


class CardInvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CardInvoice
        fields = ["id", "card", "year", "month", "amount", "is_paid", "due_date"]
        read_only_fields = ["id"]


class PayInvoiceSerializer(serializers.Serializer):
    year = serializers.IntegerField(min_value=2000, max_value=2100)
    month = serializers.IntegerField(min_value=1, max_value=12)
    is_paid = serializers.BooleanField(default=True)


def serialize_invoice(dto):
    return {
        "amount": str(dto.amount),
        "snapshot_amount": (
            str(dto.snapshot_amount) if dto.snapshot_amount is not None else None
        ),
        "is_paid": dto.is_paid,
        "divergent": dto.divergent,
        "cycle_start": dto.cycle_start.isoformat(),
        "cycle_end": dto.cycle_end.isoformat(),
        "due_date": dto.due_date.isoformat(),
    }


def serialize_card_summary(dto):
    return {
        "card_id": dto.card_id,
        "name": dto.name,
        "color": dto.color,
        "closing_day": dto.closing_day,
        "due_day": dto.due_day,
        "functions": dto.functions,
        "limit": str(dto.limit) if dto.limit is not None else None,
        "committed": str(dto.committed),
        "committed_pct": (
            str(dto.committed_pct) if dto.committed_pct is not None else None
        ),
        "open_cycle_spend": str(dto.open_cycle_spend),
        "invoice": serialize_invoice(dto.invoice),
    }
