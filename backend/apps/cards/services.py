import datetime
from decimal import Decimal

from django.db import transaction as db_transaction

from apps.cards.cycle import (
    competence_for_purchase,
    cycle_range,
    invoice_due_date,
)
from apps.cards.dtos import CardSummaryDTO, CardWriteDTO, InvoiceDTO
from apps.cards.models import Card
from apps.cards.repositories import (
    CardInvoiceRepository,
    CardPaymentMethodRepository,
    CardRepository,
    CardTransactionRepository,
)


class CardService:
    def create_card(self, user_id: int, dto: CardWriteDTO) -> Card:
        self._validate_functions(dto)
        with db_transaction.atomic():
            card = CardRepository.create(
                user_id,
                {
                    "name": dto.name,
                    "color": dto.color,
                    "closing_day": dto.closing_day,
                    "due_day": dto.due_day,
                    "limit": dto.limit,
                    "bank": dto.bank,
                    "is_active": dto.is_active,
                },
            )
            for function in dto.functions:
                CardPaymentMethodRepository.get_or_create_function(card, function)
        return card

    def update_card(self, card_id: int, user_id: int, dto: CardWriteDTO) -> Card:
        self._validate_functions(dto)
        with db_transaction.atomic():
            card = CardRepository.get_by_id(card_id, user_id)
            card.name = dto.name
            card.color = dto.color
            card.closing_day = dto.closing_day
            card.due_day = dto.due_day
            card.limit = dto.limit
            card.bank = dto.bank
            card.is_active = dto.is_active
            card.save()
            CardPaymentMethodRepository.sync_card_attrs(card)
            current = set(CardPaymentMethodRepository.active_functions(card))
            wanted = set(dto.functions)
            for function in wanted - current:
                CardPaymentMethodRepository.get_or_create_function(card, function)
            for function in current - wanted:
                CardPaymentMethodRepository.archive_function(card, function)
        return card

    def delete_card(self, card_id: int, user_id: int) -> None:
        with db_transaction.atomic():
            card = CardRepository.get_by_id(card_id, user_id)
            CardPaymentMethodRepository.detach_all(card)
            card.delete()

    @staticmethod
    def _validate_functions(dto: CardWriteDTO) -> None:
        from apps.common.exceptions import ValidationDomainError

        if not dto.functions:
            raise ValidationDomainError(
                {"functions": ["Escolha ao menos uma função (crédito/débito)."]}
            )


class CardInvoiceService:
    def summary(self, user_id: int, year: int, month: int) -> list[CardSummaryDTO]:
        today = datetime.date.today()
        result: list[CardSummaryDTO] = []
        for card in CardRepository.list_by_user(user_id):
            invoice_dto = self._build_invoice_dto(card, year, month)
            committed = CardTransactionRepository.sum_committed(
                card.id, CardInvoiceRepository.paid_periods(card.id)
            )
            committed_pct = (
                (committed / card.limit * 100).quantize(Decimal("0.01"))
                if card.limit
                else None
            )
            open_year, open_month = competence_for_purchase(card.closing_day, today)
            open_cycle_spend = CardTransactionRepository.sum_for_competence(
                card.id, open_year, open_month
            )
            functions = [
                pm.card_function
                for pm in card.payment_methods.all()
                if not pm.is_archived and pm.card_function is not None
            ]
            result.append(
                CardSummaryDTO(
                    card_id=card.id,
                    name=card.name,
                    color=card.color,
                    closing_day=card.closing_day,
                    due_day=card.due_day,
                    functions=functions,
                    limit=card.limit,
                    committed=committed,
                    committed_pct=committed_pct,
                    open_cycle_spend=open_cycle_spend,
                    invoice=invoice_dto,
                    bank=card.bank,
                    is_active=card.is_active,
                )
            )
        return result

    def set_invoice_paid(
        self, user_id: int, card_id: int, year: int, month: int, is_paid: bool
    ) -> InvoiceDTO:
        card = CardRepository.get_by_id(card_id, user_id)
        computed = CardTransactionRepository.sum_for_competence(card.id, year, month)
        due = invoice_due_date(card.closing_day, card.due_day, year, month)
        with db_transaction.atomic():
            invoice = CardInvoiceRepository.get_or_create(
                card,
                year,
                month,
                defaults={"amount": computed, "due_date": due, "is_paid": False},
            )
            invoice.amount = computed
            invoice.due_date = due
            invoice.is_paid = is_paid
            invoice.save()
            tx_ids = CardTransactionRepository.set_paid_for_competence(
                card.id, year, month, is_paid
            )
            for debt in CardTransactionRepository.affected_debts(tx_ids):
                paid_numbers = CardTransactionRepository.paid_installment_numbers(
                    debt.id
                )
                debt.installment_current = max(paid_numbers, default=0)
                debt.is_settled = debt.installment_current >= debt.installment_total
                debt.save(update_fields=["installment_current", "is_settled"])
        return self._build_invoice_dto(card, year, month)

    def _build_invoice_dto(self, card: Card, year: int, month: int) -> InvoiceDTO:
        computed = CardTransactionRepository.sum_for_competence(card.id, year, month)
        invoice = CardInvoiceRepository.get(card.id, year, month)
        is_paid = bool(invoice and invoice.is_paid)
        snapshot = invoice.amount if (invoice and is_paid) else None
        start, end = cycle_range(card.closing_day, year, month)
        return InvoiceDTO(
            amount=computed,
            snapshot_amount=snapshot,
            is_paid=is_paid,
            divergent=is_paid and snapshot != computed,
            cycle_start=start,
            cycle_end=end,
            due_date=invoice_due_date(card.closing_day, card.due_day, year, month),
        )
