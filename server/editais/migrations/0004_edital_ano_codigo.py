import re

from django.db import migrations, models


def converter_codigos(apps, schema_editor):
    Edital = apps.get_model("editais", "Edital")
    registros = Edital.objects.using(schema_editor.connection.alias)

    conversoes = {
        (1, "Teste", "2026/2"): "2026-001",
        (2, "Teste21", "2026/1"): "2026-002",
    }

    atualizacoes = []
    usados = set()

    for edital in registros.all():
        chave = (edital.pk, edital.nome, edital.ano_codigo)
        codigo = conversoes.get(chave, edital.ano_codigo)

        if not re.fullmatch(r"[0-9]{4}-[0-9]{3}", codigo):
            raise RuntimeError(
                f"Defina a conversão do código do edital ID {edital.pk} "
                "antes de aplicar esta migration."
            )

        if codigo in usados:
            raise RuntimeError(f"Código repetido na conversão: {codigo}")

        usados.add(codigo)
        atualizacoes.append((edital.pk, codigo))

    for edital_id, codigo in atualizacoes:
        registros.filter(pk=edital_id).update(ano_codigo=codigo)


class Migration(migrations.Migration):
    dependencies = [
        ("editais", "0003_alteracaocronograma"),
    ]

    operations = [
        migrations.RenameField(
            model_name="edital",
            old_name="ano_semestre",
            new_name="ano_codigo",
        ),
        migrations.AlterField(
            model_name="edital",
            name="ano_codigo",
            field=models.CharField(
                max_length=8,
                help_text="Ano e código do edital (ex: 2026-005)",
            ),
        ),
        migrations.RunPython(converter_codigos),
        migrations.AlterField(
            model_name="edital",
            name="ano_codigo",
            field=models.CharField(
                max_length=8,
                unique=True,
                help_text="Ano e código do edital (ex: 2026-005)",
            ),
        ),
    ]
