"""
Helpers de auditoria: registro de ações de negócio e filtro de escopo.

- `registrar_acao`: grava uma entrada semântica no LogEntry do auditlog.
- `editais_no_escopo`: retorna editais visíveis para um Coordenador de Área.
- `logs_visiveis_para`: filtra LogEntry de acordo com o papel do usuário.
"""

from auditlog.models import LogEntry
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q


def registrar_acao(ator, acao, objeto, detalhe=""):
    """
    Grava manualmente uma entrada semântica no LogEntry (ações de negócio que
    não são CRUD simples: aprovar, rejeitar, cancelar, publicar, encerrar…).

    Parâmetros
    ----------
    ator : accounts.Usuario
        Usuário que realizou a ação.
    acao : str
        Descrição curta em pt-BR (ex.: "Bolsa aprovada", "Edital encerrado").
    objeto : django.db.models.Model
        Instância sobre a qual a ação foi realizada.
    detalhe : str, optional
        Informação complementar (ex.: justificativa, motivo).
    """
    mudancas = {"acao": [None, acao]}
    if detalhe:
        mudancas["detalhe"] = [None, detalhe]

    LogEntry.objects.log_create(
        instance=objeto,
        action=LogEntry.Action.UPDATE,
        changes=mudancas,
        actor=ator,
    )


def editais_no_escopo(usuario):
    """
    Retorna um queryset de Edital visível para o coordenador de área informado.

    Um edital está no escopo se tem ao menos uma bolsa com
    tipo ∈ (tipo_area do coordenador, INDISSOCIAVEL).

    Administradores devem usar Edital.objects.all() diretamente.
    """
    from bolsas.models import TipoBolsa
    from editais.models import Edital

    try:
        tipo_area = usuario.perfil_coordenador_area.tipo_area
    except AttributeError:
        return Edital.objects.none()

    return Edital.objects.filter(bolsas__tipo__in=[tipo_area, TipoBolsa.INDISSOCIAVEL]).distinct()


def logs_visiveis_para(usuario, queryset_logs=None):
    """
    Filtra LogEntry de acordo com o papel do usuário.

    - ADMINISTRADOR: vê tudo.
    - COORDENADOR_AREA: vê apenas logs de objetos no seu escopo.
    - Demais: queryset vazio.

    Parâmetros
    ----------
    usuario : accounts.Usuario
    queryset_logs : QuerySet[LogEntry], optional
        Base a filtrar. Se None, usa LogEntry.objects.all().

    Retorna
    -------
    QuerySet[LogEntry]
    """
    from accounts.models import Usuario
    from bolsas.models import Bolsa, EtapaAvaliacao, TipoBolsa
    from editais.models import Edital
    from inscricoes.models import AnexoRecurso, Documento, Inscricao, NotificacaoInscricao, Recurso

    if queryset_logs is None:
        queryset_logs = LogEntry.objects.all()

    if usuario.role == Usuario.Role.ADMINISTRADOR:
        return queryset_logs

    if usuario.role == Usuario.Role.COORDENADOR_AREA:
        try:
            tipo_area = usuario.perfil_coordenador_area.tipo_area
        except AttributeError:
            return queryset_logs.none()

        # IDs de editais no escopo
        editais_ids = editais_no_escopo(usuario).values_list("id", flat=True)

        # IDs de bolsas no escopo (tipo da área ou INDISSOCIAVEL)
        bolsas_ids = Bolsa.objects.filter(
            tipo__in=[tipo_area, TipoBolsa.INDISSOCIAVEL]
        ).values_list("id", flat=True)

        # IDs de inscrições ligadas a bolsas no escopo
        inscricoes_ids = Inscricao.objects.filter(bolsa_id__in=bolsas_ids).values_list(
            "id", flat=True
        )

        # IDs de recursos ligados a inscrições no escopo
        recursos_ids = Recurso.objects.filter(inscricao_id__in=inscricoes_ids).values_list(
            "id", flat=True
        )

        ct = {
            modelo: ContentType.objects.get_for_model(modelo)
            for modelo in [
                Edital,
                Bolsa,
                EtapaAvaliacao,
                Inscricao,
                Documento,
                NotificacaoInscricao,
                Recurso,
                AnexoRecurso,
            ]
        }

        filtro = (
            # Ações próprias do coordenador — sempre visíveis (cobre editais sem bolsas ainda)
            Q(actor=usuario)
            | Q(content_type=ct[Edital], object_pk__in=[str(i) for i in editais_ids])
            | Q(content_type=ct[Bolsa], object_pk__in=[str(i) for i in bolsas_ids])
            | Q(
                content_type=ct[EtapaAvaliacao],
                object_pk__in=EtapaAvaliacao.objects.filter(bolsa_id__in=bolsas_ids).values_list(
                    "id", flat=True
                ),
            )
            | Q(content_type=ct[Inscricao], object_pk__in=[str(i) for i in inscricoes_ids])
            | Q(
                content_type=ct[Documento],
                object_pk__in=Documento.objects.filter(inscricao_id__in=inscricoes_ids).values_list(
                    "id", flat=True
                ),
            )
            | Q(
                content_type=ct[NotificacaoInscricao],
                object_pk__in=NotificacaoInscricao.objects.filter(
                    inscricao_id__in=inscricoes_ids
                ).values_list("id", flat=True),
            )
            | Q(content_type=ct[Recurso], object_pk__in=[str(i) for i in recursos_ids])
            | Q(
                content_type=ct[AnexoRecurso],
                object_pk__in=AnexoRecurso.objects.filter(recurso_id__in=recursos_ids).values_list(
                    "id", flat=True
                ),
            )
        )
        return queryset_logs.filter(filtro)

    return queryset_logs.none()
