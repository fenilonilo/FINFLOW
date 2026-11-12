from django.db import migrations, models

BANKS = [
    ("nubank", ["nubank"]),
    ("inter", ["inter"]),
    ("itau", ["itaú", "itau"]),
    ("bradesco", ["bradesco"]),
    ("santander", ["santander"]),
    ("bb", ["banco do brasil"]),
    ("caixa", ["caixa"]),
    ("c6", ["c6"]),
    ("xp", ["xp"]),
    ("btg", ["btg"]),
    ("picpay", ["picpay"]),
    ("mercadopago", ["mercado pago", "mercadopago"]),
    ("neon", ["neon"]),
    ("pan", ["banco pan", "pan"]),
]


def fill_bank(apps, schema_editor):
    Card = apps.get_model("cards", "Card")
    for card in Card.objects.all():
        name = card.name.lower()
        card.bank = next(
            (b for b, keys in BANKS if any(k in name for k in keys)), "other"
        )
        card.save(update_fields=["bank"])


class Migration(migrations.Migration):
    dependencies = [("cards", "0002_card_limit")]

    operations = [
        migrations.AddField(
            model_name="card",
            name="bank",
            field=models.CharField(
                choices=[
                    ("nubank", "Nubank"),
                    ("inter", "Inter"),
                    ("itau", "Itaú"),
                    ("bradesco", "Bradesco"),
                    ("santander", "Santander"),
                    ("bb", "Banco do Brasil"),
                    ("caixa", "Caixa"),
                    ("c6", "C6 Bank"),
                    ("xp", "XP"),
                    ("btg", "BTG Pactual"),
                    ("picpay", "PicPay"),
                    ("mercadopago", "Mercado Pago"),
                    ("neon", "Neon"),
                    ("pan", "Banco Pan"),
                    ("other", "Outro"),
                ],
                default="other",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="card",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(fill_bank, migrations.RunPython.noop),
    ]
