from rest_framework import serializers

from apps.cards.models import Card, CardInvoice


class CardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Card
        fields = ["id", "name", "color", "closing_day", "due_day"]
        read_only_fields = ["id"]


class CardInvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CardInvoice
        fields = ["id", "card", "year", "month", "amount", "due_date", "is_paid"]
        read_only_fields = ["id"]
