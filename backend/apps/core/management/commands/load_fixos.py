import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction as db_transaction

from apps.cards.dtos import CardWriteDTO
from apps.cards.models import Card
from apps.cards.services import CardService
from apps.core.models import Category, PaymentMethod
from apps.transactions.models import RecurringExpense

EMAIL = "fenilo.projetos@gmail.com"
START = datetime.date(2026, 11, 1)

PAYMENT_METHODS = ["Débito", "Pix", "Boleto", "Dinheiro"]
CARDS = [("Inter", "#f97316", 7, 14), ("Nubank", "#8b5cf6", 8, 15)]
CATEGORIES = [
    "Salário", "IMPOSTO", "Saúde", "Contas", "Uber/transporte", "Essencial",
    "Lazer", "Casa", "Contabilizei", "Educação", "Bobeira", "Alimentação",
    "Beleza", "Roupa", "Mercado", "Aluguel", "Assinaturas", "Outros",
    "Filhos", "Pet", "Presentes", "Viagem",
]  # fmt: skip
# (tipo, categoria, descrição, forma, dia, valor, cartão)
FIXOS = [
    ("income", "Salário", "Trampo", "Pix", 10, "8000.00", None),
    ("expense", "IMPOSTO", "Darf", "Débito", 15, "278.85", None),
    ("expense", "IMPOSTO", "Das", "Débito", 15, "480.00", None),
    ("expense", "Saúde", "Unimed", "Boleto", 12, "384.76", None),
    ("expense", "Saúde", "QLaira", "Pix", 13, "60.00", None),
    ("expense", "Contas", "Inter", "Débito", 14, "996.14", "Inter"),
    ("expense", "Uber/transporte", "Nubank", "Débito", 15, "935.34", "Nubank"),
    ("expense", "Essencial", "Internet", "Pix", 16, "158.39", None),
    ("expense", "Lazer", "Spotify", "Débito", 17, "13.00", None),
    ("expense", "Casa", "Apartamento", "Boleto", 10, "2199.20", None),
    ("expense", "Contabilizei", "Contabilidade", "Débito", 15, "255.00", None),
    ("expense", "Educação", "Faculdade", "Pix", 6, "569.62", None),
    ("expense", "Casa", "Leo", "Pix", 10, "1500.00", None),
]


class Command(BaseCommand):
    help = "Carrega formas, cartões, categorias e gastos fixos reais. Idempotente."

    @db_transaction.atomic
    def handle(self, *args, **options):
        user = get_user_model().objects.filter(email=EMAIL).first()
        if user is None:
            raise CommandError(f"Usuário {EMAIL} não existe.")

        pms = {}
        for name in PAYMENT_METHODS:
            pms[name], _ = PaymentMethod.objects.get_or_create(user=user, name=name)

        cards = {}
        for name, color, closing, due in CARDS:
            card = Card.objects.filter(user=user, name=name).first()
            if card is None:
                card = CardService().create_card(
                    user.id,
                    CardWriteDTO(
                        name=name,
                        color=color,
                        closing_day=closing,
                        due_day=due,
                        functions=["credit", "debit"],
                    ),
                )
            cards[name] = card

        cats = {}
        for name in CATEGORIES:
            # iexact: reaproveita "Imposto" já existente do seed antigo
            cat = Category.objects.filter(user=user, name__iexact=name).first()
            cats[name] = cat or Category.objects.create(user=user, name=name)

        for typ, cat, desc, pm, day, amount, card in FIXOS:
            RecurringExpense.objects.update_or_create(
                user=user,
                description=desc,
                defaults={
                    "type": typ,
                    "category": cats[cat],
                    "payment_method": pms[pm],
                    "due_day": day,
                    "default_amount": Decimal(amount),
                    "card": cards[card] if card else None,
                    "start_date": START,
                    "is_variable": False,
                },
            )
        self.stdout.write(self.style.SUCCESS("Fixos carregados."))
