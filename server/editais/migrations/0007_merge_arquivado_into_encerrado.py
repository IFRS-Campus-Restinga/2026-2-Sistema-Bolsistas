from django.db import migrations, models


def merge_arquivado_into_encerrado(apps, schema_editor):
    Edital = apps.get_model("editais", "Edital")
    HistoricalEdital = apps.get_model("editais", "HistoricalEdital")

    Edital.objects.filter(status="ARQUIVADO").update(status="ENCERRADO")
    HistoricalEdital.objects.filter(status="ARQUIVADO").update(status="ENCERRADO")


class Migration(migrations.Migration):
    dependencies = [
        ("editais", "0006_edital_dia_limite_frequencia_historicaledital"),
    ]

    operations = [
        migrations.RunPython(
            merge_arquivado_into_encerrado,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="edital",
            name="status",
            field=models.CharField(
                choices=[
                    ("RASCUNHO", "Rascunho"),
                    ("EM_VIGOR", "Em vigor"),
                    ("ENCERRADO", "Encerrado"),
                ],
                default="RASCUNHO",
                help_text="Status do edital",
                max_length=10,
            ),
        ),
        migrations.AlterField(
            model_name="historicaledital",
            name="status",
            field=models.CharField(
                choices=[
                    ("RASCUNHO", "Rascunho"),
                    ("EM_VIGOR", "Em vigor"),
                    ("ENCERRADO", "Encerrado"),
                ],
                default="RASCUNHO",
                help_text="Status do edital",
                max_length=10,
            ),
        ),
    ]
