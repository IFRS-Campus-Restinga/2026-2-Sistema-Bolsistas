from decimal import Decimal

from django.db import migrations

# Tabela "Valores para bolsas de fomento interno" (valor máximo por modalidade + CH).
CATALOGO = [
    ("BICT", 8, Decimal("350.00")),
    ("BICT", 12, Decimal("525.00")),
    ("BICT", 16, Decimal("700.00")),
    ("BIDTI", 8, Decimal("350.00")),
    ("BIDTI", 12, Decimal("525.00")),
    ("BIDTI", 16, Decimal("700.00")),
    ("BAT", 16, Decimal("770.00")),
]


def popular_catalogo(apps, schema_editor):
    TipoBolsaModalidade = apps.get_model("bolsas", "TipoBolsaModalidade")
    for modalidade, carga_horaria, valor_maximo in CATALOGO:
        TipoBolsaModalidade.objects.update_or_create(
            modalidade=modalidade,
            carga_horaria_semanal=carga_horaria,
            defaults={"valor_maximo": valor_maximo},
        )


class Migration(migrations.Migration):
    dependencies = [
        ("bolsas", "0006_tipo_bolsa_modalidade_edital_valor_bolsa"),
    ]

    operations = [
        migrations.RunPython(popular_catalogo, migrations.RunPython.noop),
    ]
