from django.db import migrations, models

TIPO_AREA_CHOICES = [("ENSINO", "Ensino"), ("PESQUISA", "Pesquisa"), ("EXTENSAO", "Extensão")]


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="coordenadorarea",
            name="tipo_area",
            field=models.CharField(choices=TIPO_AREA_CHOICES, max_length=20),
        ),
        migrations.CreateModel(
            name="EmailCoordenadorArea",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("email", models.EmailField(unique=True)),
                ("tipo_area", models.CharField(choices=TIPO_AREA_CHOICES, max_length=20)),
            ],
            options={
                "verbose_name": "E-mail de Coordenador de Área",
                "verbose_name_plural": "E-mails de Coordenadores de Área",
            },
        ),
    ]
