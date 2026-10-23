from .models import OrigemVinculo, VinculoBolsista


def vincular_por_indicacao(indicacao):
    return VinculoBolsista.objects.create(
        bolsa=indicacao.bolsa,
        aluno=indicacao.inscricao.aluno,
        origem=OrigemVinculo.SELECAO,
        indicacao=indicacao,
    )


def vincular_por_convite(convite):
    return VinculoBolsista.objects.create(
        bolsa=convite.bolsa,
        aluno=convite.aluno,
        origem=OrigemVinculo.VINCULO_DIRETO,
        convite=convite,
    )
