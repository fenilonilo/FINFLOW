from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.cards.api.serializers import (
    CardInvoiceSerializer,
    CardSerializer,
    PayInvoiceSerializer,
    serialize_card_summary,
    serialize_invoice,
)
from apps.cards.dtos import CardWriteDTO
from apps.cards.models import Card, CardInvoice
from apps.cards.services import CardInvoiceService, CardService
from apps.transactions.services import RecurringExpenseService


class CardViewSet(viewsets.ModelViewSet):
    serializer_class = CardSerializer

    def get_queryset(self):
        qs = Card.objects.filter(user=self.request.user).prefetch_related(
            "payment_methods"
        )
        if self.request.query_params.get("active") == "true":
            qs = qs.filter(is_active=True)
        return qs

    def _dto(self, data):
        return CardWriteDTO(
            name=data["name"],
            color=data.get("color", "#1a1a1a"),
            closing_day=data["closing_day"],
            due_day=data["due_day"],
            limit=data.get("limit"),
            functions=data.get("functions") or [],
            bank=data.get("bank", "other"),
            is_active=data.get("is_active", True),
        )

    def perform_create(self, serializer):
        card = CardService().create_card(
            self.request.user.id, self._dto(serializer.validated_data)
        )
        serializer.instance = card

    def perform_update(self, serializer):
        existing = CardSerializer(serializer.instance).data
        merged = {**existing, **serializer.validated_data}
        if "functions" not in serializer.validated_data:
            merged["functions"] = existing.get("active_functions", [])
        card = CardService().update_card(
            serializer.instance.id, self.request.user.id, self._dto(merged)
        )
        serializer.instance = card

    def perform_destroy(self, instance):
        CardService().delete_card(instance.id, self.request.user.id)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        year = int(request.query_params.get("year"))
        month = int(request.query_params.get("month"))
        RecurringExpenseService().ensure_month(request.user.id, year, month)
        data = CardInvoiceService().summary(request.user.id, year, month)
        return Response([serialize_card_summary(d) for d in data])

    @action(detail=True, methods=["post"], url_path="pay-invoice")
    def pay_invoice(self, request, pk=None):
        payload = PayInvoiceSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        dto = CardInvoiceService().set_invoice_paid(
            request.user.id,
            int(pk),
            payload.validated_data["year"],
            payload.validated_data["month"],
            payload.validated_data["is_paid"],
        )
        return Response(serialize_invoice(dto))


class CardInvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = CardInvoiceSerializer

    def get_queryset(self):
        qs = CardInvoice.objects.filter(card__user=self.request.user)
        card_pk = self.kwargs.get("card_pk")
        if card_pk:
            qs = qs.filter(card_id=card_pk)
        return qs

    def perform_create(self, serializer):
        card_pk = self.kwargs.get("card_pk")
        if card_pk:
            card = Card.objects.get(pk=card_pk, user=self.request.user)
            serializer.save(card=card)
        else:
            serializer.save()
