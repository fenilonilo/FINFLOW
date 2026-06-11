import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction as db_transaction

User = get_user_model()


class Command(BaseCommand):
    help = "Seed FinFlow with real data. Idempotent."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="felipe@finflow.app")
        parser.add_argument("--password", default="finflow123")
        parser.add_argument("--first-name", default="Felipe")

    def handle(self, *args, **options):
        with db_transaction.atomic():
            user = self._get_or_create_user(options)
            categories = self._seed_categories(user)
            payment_methods = self._seed_payment_methods(user)
            self._seed_recurring_expenses(user, categories, payment_methods)
            self._seed_transactions_2025(user, categories, payment_methods)
            self._seed_investments(user)
            self._seed_investment_goals(user)
            self._seed_cards(user)
            self._seed_debts(user, payment_methods)
        self.stdout.write(self.style.SUCCESS("Seed concluído com sucesso!"))

    def _get_or_create_user(self, options):
        user, created = User.objects.get_or_create(
            email=options["email"],
            defaults={"first_name": options["first_name"]},
        )
        if created:
            user.set_password(options["password"])
            user.save()
            self.stdout.write(f"Usuário criado: {user.email}")
        else:
            self.stdout.write(f"Usuário existente: {user.email}")
        return user

    def _seed_categories(self, user):
        from apps.core.models import Category

        cats_data = [
            ("Bobeira", "candy", "#f472b6"),
            ("Alimentação", "utensils", "#fb923c"),
            ("Saúde", "heart-pulse", "#ef4444"),
            ("Beleza", "sparkles", "#e879f9"),
            ("Roupa", "shirt", "#a78bfa"),
            ("Lazer", "gamepad-2", "#818cf8"),
            ("Uber/transporte", "car", "#60a5fa"),
            ("Mercado", "shopping-cart", "#38bdf8"),
            ("Aluguel", "home", "#2dd4bf"),
            ("Assinaturas", "repeat", "#34d399"),
            ("Essencial", "plug-zap", "#4ade80"),
            ("Outros", "circle-ellipsis", "#94a3b8"),
            ("Contas", "receipt", "#facc15"),
            ("Casa", "sofa", "#fbbf24"),
            ("Filhos", "baby", "#fb7185"),
            ("Educação", "graduation-cap", "#c084fc"),
            ("Pet", "paw-print", "#f59e0b"),
            ("Presentes", "gift", "#ec4899"),
            ("Viagem", "plane", "#22d3ee"),
            ("Imposto", "landmark", "#f87171"),
        ]
        categories = {}
        for name, icon, color in cats_data:
            cat, _ = Category.objects.get_or_create(
                user=user,
                name=name,
                defaults={"icon": icon, "color": color, "is_default": True},
            )
            categories[name] = cat
        return categories

    def _seed_payment_methods(self, user):
        from apps.core.models import PaymentMethod

        methods_data = [
            ("Pix", "zap", "#34d399"),
            ("Débito", "credit-card", "#60a5fa"),
            ("Crédito", "credit-card", "#a78bfa"),
            ("Dinheiro", "banknote", "#4ade80"),
            ("Boleto", "barcode", "#facc15"),
        ]
        methods = {}
        for name, icon, color in methods_data:
            pm, _ = PaymentMethod.objects.get_or_create(
                user=user,
                name=name,
                defaults={"icon": icon, "color": color, "is_default": True},
            )
            methods[name] = pm
        return methods

    def _seed_recurring_expenses(self, user, cats, pms):
        from apps.transactions.models import RecurringExpense

        templates = [
            ("Unimed", "Saúde", "Pix", Decimal("380.00"), 12),
            ("QLaira", "Saúde", "Pix", Decimal("58.00"), 13),
            ("Fatura Inter", "Contas", "Pix", Decimal("700.00"), 14),
            ("Fatura Nubank", "Uber/transporte", "Pix", Decimal("650.00"), 15),
            ("Internet", "Essencial", "Pix", Decimal("155.84"), 16),
            ("Spotify", "Lazer", "Débito", Decimal("23.00"), 17),
            ("Crunchyroll", "Lazer", "Pix", Decimal("8.00"), 18),
            ("Contabilizei", "Imposto", "Débito", Decimal("230.00"), 15),
            ("Faculdade", "Educação", "Pix", Decimal("569.62"), 6),
            ("Cabelo", "Beleza", "Pix", Decimal("40.00"), 1),
        ]
        recurring = {}
        for desc, cat_name, pm_name, amount, due_day in templates:
            obj, _ = RecurringExpense.objects.get_or_create(
                user=user,
                description=desc,
                defaults={
                    "category": cats[cat_name],
                    "payment_method": pms[pm_name],
                    "default_amount": amount,
                    "due_day": due_day,
                },
            )
            recurring[desc] = obj
        return recurring

    def _seed_transactions_2025(self, user, cats, pms):
        from apps.transactions.models import (
            Transaction,
            TransactionKind,
            TransactionType,
        )

        expense = TransactionType.EXPENSE
        income = TransactionType.INCOME
        fixed = TransactionKind.FIXED
        variable = TransactionKind.VARIABLE

        def _tx(
            tx_type,
            tx_kind,
            cat_name,
            desc,
            amount,
            date,
            pm_name,
            is_paid=True,
            **kw,
        ):
            Transaction.objects.get_or_create(
                user=user,
                description=desc,
                date=datetime.date.fromisoformat(date),
                amount=Decimal(str(amount)),
                defaults={
                    "type": tx_type,
                    "kind": tx_kind,
                    "category": cats.get(cat_name),
                    "payment_method": pms.get(pm_name) if pm_name else None,
                    "is_paid": is_paid,
                    **kw,
                },
            )

        # ── Janeiro 2025 — Entradas ──────────────────────────────────────────
        _tx(income, variable, None, "Salário", "8000.00", "2025-01-10", "Pix")
        _tx(income, variable, None, "Perfil Software", "2000.00", "2025-01-05", "Pix")
        _tx(income, variable, None, "Natal Sandra", "322.00", "2025-01-02", "Pix")
        _tx(income, variable, None, "Natal Evelin", "97.04", "2025-01-02", "Pix")
        _tx(income, variable, None, "Natal Marilisa", "388.12", "2025-01-02", "Pix")
        _tx(income, variable, None, "Natal Vo", "200.00", "2025-01-03", "Pix")

        # ── Janeiro 2025 — Saídas fixas ──────────────────────────────────────
        _tx(expense, fixed, "Saúde", "Unimed", "416.09", "2025-01-12", "Pix")
        _tx(expense, fixed, "Saúde", "QLaira", "58.00", "2025-01-13", "Pix")
        _tx(expense, fixed, "Contas", "Fatura Inter", "346.11", "2025-01-14", "Pix")
        _tx(
            expense,
            fixed,
            "Uber/transporte",
            "Fatura Nubank",
            "1298.76",
            "2025-01-15",
            "Pix",
        )
        _tx(expense, fixed, "Essencial", "Internet", "155.84", "2025-01-16", "Pix")
        _tx(expense, fixed, "Lazer", "Spotify", "23.00", "2025-01-17", "Débito")
        _tx(expense, fixed, "Lazer", "CRUNCHYROLL", "8.00", "2025-01-18", "Pix")
        _tx(
            expense,
            fixed,
            "Beleza",
            "Cabelo",
            "40.00",
            "2025-01-19",
            "Pix",
            is_paid=False,
        )
        _tx(expense, fixed, "Imposto", "Contabilizei", "221.60", "2025-01-15", "Pix")
        _tx(
            expense, fixed, "Imposto", "Contabilizei DAS", "715.66", "2025-01-12", "Pix"
        )

        # ── Fevereiro a Junho — agregado para bater exatamente seção 10.4 ────
        _tx(income, variable, None, "Salário", "8000.00", "2025-02-10", "Pix")
        _tx(expense, fixed, "Saúde", "Saúde Feb", "3391.66", "2025-02-12", "Pix")

        _tx(income, variable, None, "Salário", "8000.00", "2025-03-10", "Pix")
        _tx(expense, fixed, "Saúde", "Saúde Mar", "4435.29", "2025-03-12", "Pix")

        _tx(income, variable, None, "Salário", "8000.00", "2025-04-10", "Pix")
        _tx(expense, fixed, "Contas", "Contas Abr", "4601.85", "2025-04-12", "Pix")

        _tx(income, variable, None, "Salário", "8000.00", "2025-05-10", "Pix")
        _tx(expense, fixed, "Outros", "Gastos Mai", "3786.86", "2025-05-12", "Pix")

        _tx(income, variable, None, "Salário", "8000.00", "2025-06-10", "Pix")
        _tx(expense, fixed, "Outros", "Gastos Jun", "4636.58", "2025-06-12", "Pix")

        # Julho: income=0, expense=0, invested=0 — nenhuma transação.

        # ── Agosto — investimento registrado como income separado ─────────────
        _tx(
            income,
            variable,
            None,
            "Investimentos Anteriores",
            "12867.76",
            "2025-08-10",
            "Pix",
        )

        # ── Setembro 2025 — Entradas ──────────────────────────────────────────
        _tx(income, fixed, None, "Salário", "8000.00", "2025-09-10", "Pix")
        _tx(income, variable, None, "Pix Faculdade", "542.00", "2025-09-05", "Pix")
        _tx(
            income,
            variable,
            None,
            "Saldo Mês Passado",
            "12.73",
            "2025-09-02",
            "Pix",
        )

        # ── Setembro 2025 — Fixos ─────────────────────────────────────────────
        _tx(expense, fixed, "Saúde", "UNIMED", "366.05", "2025-09-12", "Boleto")
        _tx(expense, fixed, "Imposto", "CONTABILIZEI", "825.98", "2025-09-15", "Pix")
        _tx(expense, fixed, "Assinaturas", "SPOTIFY", "22.00", "2025-09-17", "Débito")
        _tx(expense, fixed, "Saúde", "QLAIRA", "56.00", "2025-09-13", "Pix")
        _tx(
            expense,
            fixed,
            "Educação",
            "FACULDADE",
            "541.82",
            "2025-09-06",
            "Boleto",
            is_paid=False,
        )
        _tx(expense, fixed, "Beleza", "CABELO", "40.00", "2025-09-01", "Pix")
        _tx(
            expense,
            fixed,
            "Lazer",
            "CRUNCHYROLL",
            "7.48",
            "2025-09-18",
            "Pix",
            is_paid=False,
        )

        # ── Setembro 2025 — Variáveis ─────────────────────────────────────────
        _tx(
            expense, variable, "Uber/transporte", "CARONA", "76.00", "2025-09-03", "Pix"
        )
        _tx(expense, variable, "Essencial", "INTERNET", "155.78", "2025-09-16", "Pix")
        _tx(
            expense,
            variable,
            "Uber/transporte",
            "UBER-Nubank",
            "357.10",
            "2025-09-15",
            "Pix",
        )
        _tx(expense, variable, "Contas", "INTER", "480.69", "2025-09-14", "Débito")
        _tx(
            expense,
            variable,
            "Alimentação",
            "DOCE E MAE",
            "150.00",
            "2025-09-20",
            "Pix",
        )
        _tx(expense, variable, "Lazer", "GC", "5.00", "2025-09-10", "Pix")
        _tx(expense, variable, "Alimentação", "IFOOD", "26.40", "2025-09-11", "Pix")
        _tx(expense, variable, "Bobeira", "CHICLETE", "2.50", "2025-09-07", "Débito")
        _tx(
            expense,
            variable,
            "Assinaturas",
            "CRUNCHYROLL",
            "10.00",
            "2025-09-08",
            "Pix",
        )
        _tx(expense, variable, "Lazer", "CINEMA", "46.07", "2025-09-15", "Pix")
        _tx(
            expense,
            variable,
            "Bobeira",
            "COCA/CERVEJA",
            "34.50",
            "2025-09-12",
            "Débito",
        )
        _tx(expense, variable, "Roupa", "CUECAS", "120.00", "2025-09-20", "Pix")
        _tx(expense, variable, "Bobeira", "COCA", "12.00", "2025-09-13", "Débito")
        _tx(expense, variable, "Bobeira", "AMERICANAS", "44.00", "2025-09-22", "Pix")
        _tx(
            expense,
            variable,
            "Lazer",
            "RODIZIO PIZZA",
            "159.94",
            "2025-09-14",
            "Débito",
        )
        _tx(expense, variable, "Bobeira", "COCA2", "12.00", "2025-09-16", "Débito")
        _tx(expense, variable, "Pet", "BANHO/TOZA", "120.00", "2025-09-25", "Pix")

        # ── Outubro a Dezembro — agregado para bater exatamente seção 10.4 ───
        _tx(income, variable, None, "Salário", "8000.00", "2025-10-10", "Pix")
        _tx(expense, fixed, "Outros", "Gastos Out", "3686.22", "2025-10-12", "Pix")

        _tx(income, variable, None, "Salário", "7167.75", "2025-11-10", "Pix")
        _tx(expense, fixed, "Outros", "Gastos Nov", "1963.02", "2025-11-12", "Pix")

        _tx(income, variable, None, "Salário", "7353.02", "2025-12-10", "Pix")
        _tx(expense, fixed, "Outros", "Gastos Dez", "2999.22", "2025-12-12", "Pix")

    def _seed_investments(self, user):
        from apps.investments.models import Investment

        investments = [
            ("2025-01-10", "FUNDO INTER FIRF CP", "5000.00"),
            ("2025-05-10", "CDI", "4000.00"),
            ("2025-08-10", "Investimentos Anteriores", "12867.76"),
            ("2025-09-10", "FUNDO INTER FIRF CP", "4000.00"),
            ("2025-10-10", "Apartamento", "3000.00"),
            ("2025-11-10", "Renda Fixa", "3500.00"),
        ]
        for date_str, location, amount in investments:
            date = datetime.date.fromisoformat(date_str)
            Investment.objects.get_or_create(
                user=user,
                date=date,
                location=location,
                defaults={
                    "year": date.year,
                    "month": date.month,
                    "amount": Decimal(amount),
                },
            )

    def _seed_investment_goals(self, user):
        from apps.investments.models import InvestmentGoal

        goals = [
            (2025, 8, "12867.76"),
            (2025, 9, "4000.00"),
            (2025, 10, "4000.00"),
            (2025, 11, "4000.00"),
            (2025, 12, "4000.00"),
        ]
        for year, month, amount in goals:
            InvestmentGoal.objects.get_or_create(
                user=user,
                year=year,
                month=month,
                defaults={"target_amount": Decimal(amount)},
            )

    def _seed_cards(self, user):
        from apps.cards.models import Card

        cards_data = [
            ("Nubank", "#820ad1", 12, 19),
            ("Inter", "#ff7a00", 12, 19),
            ("PicPay", "#21c25e", 5, 12),
            ("Santander", "#ec0000", 5, 12),
            ("C6 Bank", "#1a1a1a", 12, 19),
        ]
        for name, color, closing_day, due_day in cards_data:
            Card.objects.get_or_create(
                user=user,
                name=name,
                defaults={
                    "color": color,
                    "closing_day": closing_day,
                    "due_day": due_day,
                },
            )

    def _seed_debts(self, user, pms):  # noqa: ARG002
        from apps.transactions.models import Debt

        debts_data = [
            ("HotPark", 2, 10, "39.80", "390.80", "2024-07-03"),
            ("Felipe L.", 2, 6, "316.17", "1900.00", "2024-07-02"),
            ("Carlos Mec.", 2, 4, "125.00", "500.00", "2024-07-02"),
        ]
        for (
            creditor,
            inst_curr,
            inst_total,
            inst_amount,
            total_amount,
            start_date,
        ) in debts_data:
            Debt.objects.get_or_create(
                user=user,
                creditor=creditor,
                defaults={
                    "installment_current": inst_curr,
                    "installment_total": inst_total,
                    "installment_amount": Decimal(inst_amount),
                    "total_amount": Decimal(total_amount),
                    "start_date": datetime.date.fromisoformat(start_date),
                },
            )
