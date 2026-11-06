from collections import Counter

from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Usuario
from accounts.permissions import IsAdministrador
from auditoria.models import LogAuditoria
from auditoria.serializers import LogAuditoriaSerializer
from bolsas.models import Bolsa, StatusBolsa, TipoBolsa
from editais.models import Edital
from inscricoes.models import Inscricao, Recurso, StatusInscricao, StatusRecurso
from projetos.models import Projeto
from selecao.models import IndicacaoBolsista, ResultadoInscricao, SituacaoClassificacao
from vinculo_direto.models import ConviteVinculoDireto, StatusConvite


class MonitoramentoGlobalView(APIView):
    permission_classes = [IsAuthenticated, IsAdministrador]

    def get(self, request):
        editais_ativos = list(
            Edital.objects.filter(
                status=Edital.Status.EM_VIGOR,
            ).order_by("ano_codigo")
        )

        projetos_cadastrados = list(
            Projeto.objects.select_related("coordenador_projeto__usuario").order_by("titulo")
        )

        usuarios_ativos = list(Usuario.objects.filter(is_active=True).order_by("nome"))
        usuarios_inativos = list(Usuario.objects.filter(is_active=False).order_by("nome"))

        bolsas_ativas = list(
            Bolsa.objects.filter(
                status__in=[
                    StatusBolsa.ABERTA,
                    StatusBolsa.EM_SELECAO,
                ]
            )
            .select_related("projeto", "edital")
            .order_by("projeto__titulo")
        )

        inscricoes_ativas = list(
            Inscricao.objects.filter(
                status=StatusInscricao.HOMOLOGADA,
            )
            .select_related("aluno", "bolsa__projeto", "bolsa__edital")
            .order_by("aluno__nome")
        )

        inscricoes_encerradas = list(
            Inscricao.objects.filter(
                status__in=[
                    StatusInscricao.CANCELADA,
                    StatusInscricao.INDEFERIDA,
                ]
            )
            .select_related("aluno", "bolsa__projeto", "bolsa__edital")
            .order_by("aluno__nome")
        )

        return Response(
            {
                "totais": {
                    "editais_ativos": len(editais_ativos),
                    "projetos_cadastrados": len(projetos_cadastrados),
                    "usuarios_ativos": len(usuarios_ativos),
                    "usuarios_inativos": len(usuarios_inativos),
                    "bolsas_ativas": len(bolsas_ativas),
                    "inscricoes_ativas": len(inscricoes_ativas),
                    "inscricoes_encerradas": len(inscricoes_encerradas),
                },
                "detalhes": {
                    "editais_ativos": [
                        {
                            "nome": edital.nome,
                            "ano_codigo": edital.ano_codigo,
                            "status": edital.status,
                        }
                        for edital in editais_ativos
                    ],
                    "projetos_cadastrados": [
                        {
                            "titulo": projeto.titulo,
                            "coordenador": projeto.coordenador_projeto.usuario.nome,
                            "status": projeto.status,
                        }
                        for projeto in projetos_cadastrados
                    ],
                    "usuarios_ativos": [
                        {
                            "nome": usuario.nome,
                            "email": usuario.email,
                            "perfil": usuario.get_role_display(),
                            "status": "ATIVO",
                        }
                        for usuario in usuarios_ativos
                    ],
                    "usuarios_inativos": [
                        {
                            "nome": usuario.nome,
                            "email": usuario.email,
                            "perfil": usuario.get_role_display(),
                            "status": "INATIVO",
                        }
                        for usuario in usuarios_inativos
                    ],
                    "bolsas_ativas": [
                        {
                            "projeto": bolsa.projeto.titulo,
                            "edital": bolsa.edital.nome,
                            "tipo": bolsa.get_tipo_display(),
                            "status": bolsa.status,
                        }
                        for bolsa in bolsas_ativas
                    ],
                    "inscricoes_ativas": [
                        {
                            "aluno": inscricao.aluno.nome,
                            "projeto": inscricao.bolsa.projeto.titulo,
                            "edital": inscricao.bolsa.edital.nome,
                            "status": inscricao.status,
                        }
                        for inscricao in inscricoes_ativas
                    ],
                    "inscricoes_encerradas": [
                        {
                            "aluno": inscricao.aluno.nome,
                            "projeto": inscricao.bolsa.projeto.titulo,
                            "edital": inscricao.bolsa.edital.nome,
                            "status": inscricao.status,
                        }
                        for inscricao in inscricoes_encerradas
                    ],
                },
            }
        )


STATUS_BOLSA_OFERTADA = [
    StatusBolsa.APROVADA,
    StatusBolsa.ABERTA,
    StatusBolsa.EM_SELECAO,
    StatusBolsa.PREENCHIDA,
    StatusBolsa.ENCERRADA,
]

QUANTIDADE_ATIVIDADES_RECENTES = 5


def _edital_do_filtro(request, editais):
    texto = request.query_params.get("edital", "").strip()
    if not texto:
        return None
    edital = next((edital for edital in editais if str(edital.pk) == texto), None)
    if edital is None:
        raise ValidationError({"edital": "Edital inválido."})
    return edital


def _vagas_por_tipo(bolsas, ocupadas_por_bolsa):
    vagas = {tipo: {"ocupadas": 0, "total": 0} for tipo in TipoBolsa.values}
    for bolsa in bolsas:
        vagas[bolsa.tipo]["total"] += bolsa.quantidade_vagas
        vagas[bolsa.tipo]["ocupadas"] += ocupadas_por_bolsa.get(bolsa.pk, 0)
    return [{"tipo": tipo, "rotulo": rotulo, **vagas[tipo]} for tipo, rotulo in TipoBolsa.choices]


class PainelAdministrativoView(APIView):
    """Contagens do dashboard do administrador; o filtro opcional `edital` restringe tudo menos a atividade recente."""

    permission_classes = [IsAuthenticated, IsAdministrador]

    def get(self, request):
        editais = list(
            Edital.objects.exclude(status=Edital.Status.RASCUNHO).order_by("-ano_codigo", "-pk")
        )
        edital = _edital_do_filtro(request, editais)

        bolsas = Bolsa.objects.all()
        if edital:
            bolsas = bolsas.filter(edital=edital)

        ofertadas = list(bolsas.filter(status__in=STATUS_BOLSA_OFERTADA))
        ocupadas_por_bolsa = Counter(
            IndicacaoBolsista.objects.filter(bolsa__in=ofertadas).values_list("bolsa_id", flat=True)
        )
        ocupadas_por_bolsa.update(
            ConviteVinculoDireto.objects.filter(
                bolsa__in=ofertadas, status=StatusConvite.APROVADO
            ).values_list("bolsa_id", flat=True)
        )
        vagas_por_tipo = _vagas_por_tipo(ofertadas, ocupadas_por_bolsa)

        enviadas = Inscricao.objects.filter(bolsa__in=bolsas).exclude(
            status=StatusInscricao.RASCUNHO
        )

        logs = LogAuditoria.objects.all()[:QUANTIDADE_ATIVIDADES_RECENTES]

        return Response(
            {
                "editais": [
                    {
                        "id": item.pk,
                        "nome": item.nome,
                        "ano_codigo": item.ano_codigo,
                        "status": item.status,
                        "status_display": item.get_status_display(),
                    }
                    for item in editais
                ],
                "edital": edital.pk if edital else None,
                "editais_em_vigor": sum(
                    1 for item in editais if item.status == Edital.Status.EM_VIGOR
                ),
                "bolsas": {
                    "ofertadas": len(ofertadas),
                    "projetos": len({bolsa.projeto_id for bolsa in ofertadas}),
                },
                "vagas": {
                    "ocupadas": sum(item["ocupadas"] for item in vagas_por_tipo),
                    "total": sum(item["total"] for item in vagas_por_tipo),
                    "por_tipo": vagas_por_tipo,
                },
                "funil": {
                    "enviadas": enviadas.count(),
                    "homologadas": enviadas.filter(status=StatusInscricao.HOMOLOGADA).count(),
                    "classificadas": ResultadoInscricao.objects.filter(
                        inscricao__in=enviadas,
                        situacao__in=[
                            SituacaoClassificacao.TITULAR,
                            SituacaoClassificacao.SUPLENTE,
                        ],
                    ).count(),
                    "vinculadas": IndicacaoBolsista.objects.filter(bolsa__in=bolsas).count(),
                },
                "pendencias": {
                    "bolsas_aguardando_aprovacao": bolsas.filter(
                        status=StatusBolsa.SOLICITADA
                    ).count(),
                    "recursos_sem_julgamento": Recurso.objects.filter(
                        inscricao__bolsa__in=bolsas, status=StatusRecurso.PENDENTE
                    ).count(),
                    "convites_aguardando_analise": ConviteVinculoDireto.objects.filter(
                        bolsa__in=bolsas, status=StatusConvite.ENVIADO
                    ).count(),
                },
                "atividade_recente": LogAuditoriaSerializer(logs, many=True).data,
            }
        )
