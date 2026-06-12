from rest_framework import status, viewsets
from rest_framework.response import Response

from apps.core.api.serializers import CategorySerializer, PaymentMethodSerializer
from apps.core.models import Category, PaymentMethod
from apps.core.services import CategoryService


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer

    def get_queryset(self):
        qs = Category.objects.filter(user=self.request.user)
        if not self.request.query_params.get("include_archived"):
            qs = qs.filter(is_archived=False)
        return qs

    def perform_create(self, serializer):
        parent = serializer.validated_data.get("parent")
        service = CategoryService()
        category = service.create(
            user_id=self.request.user.id,
            name=serializer.validated_data["name"],
            icon=serializer.validated_data.get("icon", "circle"),
            color=serializer.validated_data.get("color", "#94a3b8"),
            parent_id=parent.id if parent else None,
            monthly_budget=serializer.validated_data.get("monthly_budget"),
        )
        serializer.instance = category

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        CategoryService().delete(instance.id, request.user.id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PaymentMethodViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentMethodSerializer

    def get_queryset(self):
        qs = PaymentMethod.objects.filter(user=self.request.user).select_related("card")
        if not self.request.query_params.get("include_archived"):
            qs = qs.filter(is_archived=False)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
