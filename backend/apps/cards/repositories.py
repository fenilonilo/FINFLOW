from decimal import Decimal
from typing import Any

from django.db.models import QuerySet, Sum

from apps.cards.models import Card, CardInvoice
from apps.core.models import CardFunction, PaymentMethod
from apps.transactions.models import Debt, Transaction, TransactionType


class CardRepository:
    @staticmethod
    def get_by_id(card_id: int, user_id: int) -> Card:
        from apps.common.exceptions import NotFoundError

        try:
            return Card.objects.get(id=card_id, user_id=user_id)
        except Card.DoesNotExist:
            raise NotFoundError(f"Card {card_id} not found")

    @staticmethod
    def list_by_user(user_id: int) -> list[Card]:
        return list(
            Card.objects.filter(user_id=user_id)
            .order_by("-is_active", "id")
            .prefetch_related("payment_methods")
        )

    @staticmethod
    def create(user_id: int, data: dict[str, Any]) -> Card:
        return Card.objects.create(user_id=user_id, **data)


class CardPaymentMethodRepository:
    FUNCTION_LABELS: dict[str, str] = {
        CardFunction.CREDIT: "Crédito",
        CardFunction.DEBIT: "Débito",
    }

    @classmethod
    def get_or_create_function(cls, card: Card, function: str) -> PaymentMethod:
        pm = PaymentMethod.objects.filter(card=card, card_function=function).first()
        if pm:
            if pm.is_archived:
                pm.is_archived = False
                pm.save(update_fields=["is_archived"])
            return pm
        return PaymentMethod.objects.create(
            user_id=card.user_id,
            card=card,
            card_function=function,
            name=f"{card.name} {cls.FUNCTION_LABELS[function]}",
            color=card.color,
            icon="credit-card",
        )

    @staticmethod
    def active_functions(card: Card) -> list[str]:
        return [
            value
            for value in PaymentMethod.objects.filter(
                card=card, is_archived=False
            ).values_list("card_function", flat=True)
            if value is not None
        ]

    @staticmethod
    def archive_function(card: Card, function: str) -> None:
        PaymentMethod.objects.filter(card=card, card_function=function).update(
            is_archived=True
        )

    @classmethod
    def sync_card_attrs(cls, card: Card) -> None:
        for pm in PaymentMethod.objects.filter(card=card):
            if pm.card_function is None:
                continue
            pm.name = f"{card.name} {cls.FUNCTION_LABELS[pm.card_function]}"
            pm.color = card.color
            pm.save(update_fields=["name", "color"])

    @staticmethod
    def detach_all(card: Card) -> None:
        PaymentMethod.objects.filter(card=card).update(
            card=None, card_function=None, is_archived=True
        )


class CardInvoiceRepository:
    @staticmethod
    def get(card_id: int, year: int, month: int) -> CardInvoice | None:
        return CardInvoice.objects.filter(
            card_id=card_id, year=year, month=month
        ).first()

    @staticmethod
    def get_or_create(
        card: Card, year: int, month: int, defaults: dict[str, Any]
    ) -> CardInvoice:
        invoice, _ = CardInvoice.objects.get_or_create(
            card=card, year=year, month=month, defaults=defaults
        )
        return invoice

    @staticmethod
    def paid_periods(card_id: int) -> list[tuple[int, int]]:
        return list(
            CardInvoice.objects.filter(card_id=card_id, is_paid=True).values_list(
                "year", "month"
            )
        )


class CardTransactionRepository:
    @staticmethod
    def _credit_qs(card_id: int) -> QuerySet[Transaction]:
        return Transaction.objects.filter(
            payment_method__card_id=card_id,
            payment_method__card_function=CardFunction.CREDIT,
            type=TransactionType.EXPENSE,
        )

    @classmethod
    def sum_for_competence(cls, card_id: int, year: int, month: int) -> Decimal:
        result = (
            cls._credit_qs(card_id)
            .filter(year=year, month=month)
            .aggregate(total=Sum("amount"))
        )
        return result["total"] or Decimal("0")

    @classmethod
    def sum_committed(
        cls, card_id: int, paid_periods: list[tuple[int, int]]
    ) -> Decimal:
        qs = cls._credit_qs(card_id)
        for year, month in paid_periods:
            qs = qs.exclude(year=year, month=month)
        return qs.aggregate(total=Sum("amount"))["total"] or Decimal("0")

    @classmethod
    def set_paid_for_competence(
        cls, card_id: int, year: int, month: int, is_paid: bool
    ) -> list[int]:
        ids: list[int] = list(
            cls._credit_qs(card_id)
            .filter(year=year, month=month)
            .values_list("id", flat=True)
        )
        Transaction.objects.filter(id__in=ids).update(is_paid=is_paid)
        return ids

    @staticmethod
    def affected_debts(tx_ids: list[int]) -> list[Debt]:
        return list(Debt.objects.filter(installments__id__in=tx_ids).distinct())

    @staticmethod
    def paid_installment_numbers(debt_id: int) -> list[int]:
        return [
            value
            for value in Transaction.objects.filter(debt_id=debt_id, is_paid=True)
            .exclude(installment_current=None)
            .values_list("installment_current", flat=True)
            if value is not None
        ]
