from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdministrador
from bolsas.models import Bolsa, StatusBolsa
from editais.models import Edital
from inscricoes.models import Inscricao, StatusInscricao


class MonitoramentoGlobalView(APIView):
    permission_classes = [IsAuthenticated, IsAdministrador]

    def get(self, request):
        editais_ativos = list(
            Edital.objects.filter(
                status=Edital.Status.EM_VIGOR,
            ).order_by("ano_codigo")
        )

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
