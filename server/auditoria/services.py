from .models import LogAuditoria


def registrar_log(
    *,
    usuario,
    acao,
    entidade,
    entidade_id="",
    descricao="",
):
    responsavel = usuario if usuario is not None and usuario.is_authenticated else None

    return LogAuditoria.objects.create(
        usuario=responsavel,
        acao=acao,
        entidade=entidade,
        entidade_id=str(entidade_id) if entidade_id else "",
        descricao=descricao,
    )
