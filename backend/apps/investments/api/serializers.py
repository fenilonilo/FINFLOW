from rest_framework import serializers

from apps.investments.models import Investment, InvestmentGoal


class InvestmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Investment
        fields = ["id", "year", "month", "date", "location", "amount"]
        read_only_fields = ["id", "year", "month"]

    def validate(self, data):
        if "date" in data:
            data["year"] = data["date"].year
            data["month"] = data["date"].month
        return data


class InvestmentGoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvestmentGoal
        fields = ["id", "year", "month", "target_amount"]
        read_only_fields = ["id"]
