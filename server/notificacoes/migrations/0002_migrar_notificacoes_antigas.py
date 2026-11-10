import re

from django.db import migrations

# (trecho da mensagem, título, tom, destino) — primeira regra que casar vence.
REGRAS_INSCRICAO = [
    ("recurso de homologação", "foi deferido", "Recurso deferido", "SUCESSO", "recursos"),
    ("recurso de homologação", "foi indeferido", "Recurso indeferido", "ERRO", "recursos"),
    ("Sua inscrição", "foi homologada", "Inscrição homologada", "SUCESSO", "inscricoes"),
    ("Sua inscrição", "foi indeferida", "Inscrição indeferida", "ERRO", "inscricoes"),
    ("resultado da seleção", "", "Resultado da seleção publicado", "INFO", "inscricoes"),
    ("indicado(a) como bolsista", "", "Indicação como bolsista", "SUCESSO", "minha-bolsa"),
    ("não vai assumir a vaga", "", "Vaga não assumida", "AVISO", "inscricoes"),
]


def _texto_atual(mensagem, titulo_projeto):
    # Mesma limpeza que o NotificacaoInscricaoSerializer aplicava ao exibir mensagens antigas.
    mensagem = re.sub(r"^Seu recurso #\d+ de homologação", "Seu recurso de homologação", mensagem)
    prefixo, separador, restante = mensagem.partition(" foi ")
    prefixo = re.sub(r" \(bolsa #\d+\)", "", prefixo)
    prefixo = re.sub(
        r", na bolsa #\d+,", lambda _: f', na bolsa do projeto "{titulo_projeto}",', prefixo
    )
    return prefixo + separador + restante


def _classificar(mensagem):
    for trecho, complemento, titulo, tom, destino in REGRAS_INSCRICAO:
        if trecho in mensagem and complemento in mensagem:
            return titulo, tom, destino
    return "Atualização da inscrição", "INFO", "inscricoes"


def migrar(apps, schema_editor):
    Notificacao = apps.get_model("notificacoes", "Notificacao")
    NotificacaoInscricao = apps.get_model("inscricoes", "NotificacaoInscricao")
    NotificacaoConvite = apps.get_model("vinculo_direto", "NotificacaoConvite")

    novas = []
    for antiga in NotificacaoInscricao.objects.select_related("inscricao__bolsa__projeto").order_by(
        "id"
    ):
        inscricao = antiga.inscricao
        mensagem = _texto_atual(antiga.mensagem, inscricao.bolsa.projeto.titulo)
        titulo, tom, destino = _classificar(mensagem)
        novas.append(
            Notificacao(
                destinatario_id=inscricao.aluno_id,
                tom=tom,
                titulo=titulo,
                mensagem=mensagem,
                destino=destino,
                criada_em=antiga.criada_em,
                lida_em=antiga.lida_em,
            )
        )

    for antiga in NotificacaoConvite.objects.order_by("id"):
        novas.append(
            Notificacao(
                destinatario_id=antiga.coordenador_area_id,
                tom="INFO",
                titulo="Vínculo direto efetivado",
                mensagem=antiga.mensagem,
                destino="solicitacoes",
                criada_em=antiga.criada_em,
                lida_em=antiga.lida_em,
            )
        )

    Notificacao.objects.bulk_create(novas)


class Migration(migrations.Migration):
    dependencies = [
        ("notificacoes", "0001_initial"),
        ("inscricoes", "0004_documento_convite_alter_documento_inscricao_and_more"),
        ("vinculo_direto", "0002_notificacaoconvite"),
    ]

    operations = [migrations.RunPython(migrar, migrations.RunPython.noop)]
