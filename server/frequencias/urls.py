from django.urls import path

from .views import (
    CienciaSolicitacaoView,
    DecidirPagamentoView,
    ExportarAcompanhamentoView,
    FrequenciasDoMesView,
    LancarFrequenciaView,
    MinhasFrequenciasView,
    PendenciasAreaView,
    SituacaoAreaView,
    SolicitacoesRecebidasView,
    SolicitarFrequenciaView,
)

app_name = "frequencias"

urlpatterns = [
    path("", FrequenciasDoMesView.as_view(), name="do-mes"),
    path("lancamentos/", LancarFrequenciaView.as_view(), name="lancar"),
    path("<int:pk>/pagamento/", DecidirPagamentoView.as_view(), name="pagamento"),
    path("exportar/", ExportarAcompanhamentoView.as_view(), name="exportar"),
    path("solicitacoes/", SolicitarFrequenciaView.as_view(), name="solicitar"),
    path(
        "solicitacoes/recebidas/",
        SolicitacoesRecebidasView.as_view(),
        name="solicitacoes-recebidas",
    ),
    path(
        "solicitacoes/<int:pk>/ciencia/",
        CienciaSolicitacaoView.as_view(),
        name="ciencia-solicitacao",
    ),
    path("area/situacao/", SituacaoAreaView.as_view(), name="situacao-area"),
    path("area/pendencias/", PendenciasAreaView.as_view(), name="pendencias-area"),
    path("minhas/", MinhasFrequenciasView.as_view(), name="minhas"),
]
