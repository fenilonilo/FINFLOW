from rest_framework import serializers

from apps.acquisitions.models import Acquisition, AcquisitionInstallment


class AcquisitionInstallmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcquisitionInstallment
        fields = [
            "number",
            "due_date",
            "amount",
            "interest_portion",
            "principal_portion",
            "remaining_balance",
        ]


class AcquisitionSerializer(serializers.ModelSerializer):
    installments = AcquisitionInstallmentSerializer(many=True, read_only=True)

    class Meta:
        model = Acquisition
        fields = [
            "id",
            "name",
            "total_value",
            "acquisition_type",
            "down_payment",
            "installments_count",
            "monthly_interest_rate",
            "amortization_system",
            "extra_monthly_cost",
            "start_date",
            "status",
            "category",
            "recurring_expense",
            "result_snapshot",
            "installments",
        ]
        read_only_fields = [
            "id",
            "status",
            "recurring_expense",
            "result_snapshot",
            "installments",
        ]


class SimulateRequestSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    total_value = serializers.DecimalField(max_digits=12, decimal_places=2)
    acquisition_type = serializers.ChoiceField(
        choices=["cash", "installment", "financing", "consortium"]
    )
    down_payment = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    installments_count = serializers.IntegerField(required=False, allow_null=True)
    monthly_interest_rate = serializers.DecimalField(
        max_digits=7, decimal_places=4, required=False, allow_null=True
    )
    amortization_system = serializers.ChoiceField(
        choices=["price", "sac", "none"], default="none"
    )
    extra_monthly_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    start_date = serializers.DateField()
    category = serializers.IntegerField(required=False, allow_null=True)
    user_id = serializers.IntegerField(required=False)
