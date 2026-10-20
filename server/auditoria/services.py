from .models import AcaoAuditoria, EntidadeAuditoria, LogAuditoria


def registrar_log(
    *,
    usuario,
    acao,
    entidade,
    entidade_id="",
    descricao="",
):
    # Os choices do model não são validados no .create(); sem isto um código digitado
    # errado seria gravado e sumiria dos filtros.
    acao = AcaoAuditoria(acao)
    entidade = EntidadeAuditoria(entidade)
    responsavel = usuario if usuario is not None and usuario.is_authenticated else None

    return LogAuditoria.objects.create(
        usuario=responsavel,
        acao=acao,
        entidade=entidade,
        entidade_id=str(entidade_id) if entidade_id else "",
        descricao=descricao,
    )
