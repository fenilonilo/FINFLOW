import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction as db_transaction

from apps.cards.dtos import CardWriteDTO
from apps.cards.models import Card
from apps.cards.services import CardService
from apps.core.models import Category, PaymentMethod
from apps.transactions.models import RecurringExpense, Transaction

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
# (tipo, categoria, descrição, forma, dia, valor). Fatura de cartão não é fixo.
FIXOS = [
    ("income", "Salário", "Trampo", "Pix", 10, "8000.00"),
    ("expense", "IMPOSTO", "Darf", "Débito", 15, "278.85"),
    ("expense", "IMPOSTO", "Das", "Débito", 15, "480.00"),
    ("expense", "Saúde", "Unimed", "Boleto", 12, "384.76"),
    ("expense", "Saúde", "QLaira", "Pix", 13, "60.00"),
    ("expense", "Essencial", "Internet", "Pix", 16, "158.39"),
    ("expense", "Lazer", "Spotify", "Débito", 17, "13.00"),
    ("expense", "Casa", "Apartamento", "Boleto", 10, "2199.20"),
    ("expense", "Contabilizei", "Contabilidade", "Débito", 15, "255.00"),
    ("expense", "Educação", "Faculdade", "Pix", 6, "569.62"),
    ("expense", "Casa", "Leo", "Pix", 10, "1500.00"),
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

        for name, color, closing, due in CARDS:
            if not Card.objects.filter(user=user, name=name).exists():
                CardService().create_card(
                    user.id,
                    CardWriteDTO(
                        name=name,
                        color=color,
                        closing_day=closing,
                        due_day=due,
                        functions=["credit", "debit"],
                    ),
                )

        cats = {}
        for name in CATEGORIES:
            # iexact: reaproveita "Imposto" já existente do seed antigo
            cat = Category.objects.filter(user=user, name__iexact=name).first()
            cats[name] = cat or Category.objects.create(user=user, name=name)

        # Fixos ligados a cartão (fatura) foram descontinuados.
        card_fixed = RecurringExpense.objects.filter(user=user, card__isnull=False)
        Transaction.objects.filter(recurring_source__in=card_fixed).delete()
        card_fixed.delete()

        for typ, cat, desc, pm, day, amount in FIXOS:
            RecurringExpense.objects.update_or_create(
                user=user,
                description=desc,
                defaults={
                    "type": typ,
                    "category": cats[cat],
                    "payment_method": pms[pm],
                    "due_day": day,
                    "default_amount": Decimal(amount),
                    "start_date": START,
                    "is_variable": False,
                },
            )
        self.stdout.write(self.style.SUCCESS("Fixos carregados."))
