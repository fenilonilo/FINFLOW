from django.db import transaction as db_transaction

from apps.cards.dtos import CardWriteDTO
from apps.cards.models import Card
from apps.cards.repositories import CardPaymentMethodRepository, CardRepository


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
