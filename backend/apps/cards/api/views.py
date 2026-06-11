from rest_framework import viewsets

from apps.cards.api.serializers import CardInvoiceSerializer, CardSerializer
from apps.cards.models import Card, CardInvoice


class CardViewSet(viewsets.ModelViewSet):
    serializer_class = CardSerializer

    def get_queryset(self):
        return Card.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


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
