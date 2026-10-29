from django.db import migrations


def criar_vinculos_existentes(apps, schema_editor):
    """Gera o vínculo dos bolsistas que já existiam antes deste modelo."""
    VinculoBolsista = apps.get_model("bolsistas", "VinculoBolsista")
    IndicacaoBolsista = apps.get_model("selecao", "IndicacaoBolsista")
    ConviteVinculoDireto = apps.get_model("vinculo_direto", "ConviteVinculoDireto")

    for indicacao in IndicacaoBolsista.objects.select_related("inscricao"):
        VinculoBolsista.objects.get_or_create(
            indicacao=indicacao,
            defaults={
                "bolsa_id": indicacao.bolsa_id,
                "aluno_id": indicacao.inscricao.aluno_id,
                "origem": "SELECAO",
            },
        )

    for convite in ConviteVinculoDireto.objects.filter(status="APROVADO"):
        VinculoBolsista.objects.get_or_create(
            convite=convite,
            defaults={
                "bolsa_id": convite.bolsa_id,
                "aluno_id": convite.aluno_id,
                "origem": "VINCULO_DIRETO",
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("bolsistas", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(criar_vinculos_existentes, migrations.RunPython.noop),
    ]
