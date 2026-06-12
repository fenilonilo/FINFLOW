from rest_framework import serializers

from apps.core.models import Category, PaymentMethod


class CategorySerializer(serializers.ModelSerializer):
    transaction_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "icon",
            "color",
            "parent",
            "monthly_budget",
            "is_default",
            "is_archived",
            "transaction_count",
        ]
        read_only_fields = ["id", "is_default", "transaction_count"]

    def get_transaction_count(self, obj):
        from apps.transactions.models import Transaction

        return Transaction.objects.filter(category=obj).count()


class PaymentMethodSerializer(serializers.ModelSerializer):
    card_detail = serializers.SerializerMethodField()

    class Meta:
        model = PaymentMethod
        fields = [
            "id",
            "name",
            "icon",
            "color",
            "is_default",
            "is_archived",
            "card",
            "card_function",
            "card_detail",
        ]
        read_only_fields = ["id", "is_default", "card", "card_function", "card_detail"]

    def get_card_detail(self, obj):
        if not obj.card_id:
            return None
        return {
            "id": obj.card_id,
            "name": obj.card.name,
            "color": obj.card.color,
            "closing_day": obj.card.closing_day,
        }
