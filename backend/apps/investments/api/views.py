from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.investments.api.serializers import (
    InvestmentGoalSerializer,
    InvestmentSerializer,
)
from apps.investments.models import Investment, InvestmentGoal


class InvestmentViewSet(viewsets.ModelViewSet):
    serializer_class = InvestmentSerializer

    def get_queryset(self):
        return Investment.objects.filter(user=self.request.user).order_by("date")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class InvestmentGoalViewSet(viewsets.ModelViewSet):
    serializer_class = InvestmentGoalSerializer

    def get_queryset(self):
        return InvestmentGoal.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["put"], url_path="bulk")
    def bulk(self, request):
        year = request.data.get("year")
        goals = request.data.get("goals", [])
        created = []
        for g in goals:
            obj, _ = InvestmentGoal.objects.update_or_create(
                user=request.user,
                year=year,
                month=g["month"],
                defaults={"target_amount": g["target_amount"]},
            )
            created.append(InvestmentGoalSerializer(obj).data)
        return Response(created)
