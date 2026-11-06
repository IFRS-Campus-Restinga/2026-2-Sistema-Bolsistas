from django.urls import path

from .views import (
    BolsasParaFinalizarView,
    BolsistasDoCoordenadorView,
    CancelamentosRecentesAreaView,
    CancelarVagaView,
    CienciaCancelamentoVagaView,
    CienciaDesligamentoView,
    DecidirDesligamentoView,
    DesligamentosRecentesAreaView,
    MeusPedidosDesligamentoView,
    MeusVinculosView,
    ParecerRelatorioView,
    PedidosDesligamentoPendentesView,
    RelatorioFinalArquivoView,
    RelatorioFinalView,
    SolicitarDesligamentoCoordenadorView,
    SolicitarMeuDesligamentoView,
    SolicitarRelatorioView,
)

app_name = "bolsistas"

urlpatterns = [
    path("meus-vinculos/", MeusVinculosView.as_view(), name="meus-vinculos"),
    path(
        "meus-desligamentos/",
        MeusPedidosDesligamentoView.as_view(),
        name="meus-desligamentos",
    ),
    path(
        "meus-vinculos/<int:pk>/desligamento/",
        SolicitarMeuDesligamentoView.as_view(),
        name="solicitar-meu-desligamento",
    ),
    path("vinculos/", BolsistasDoCoordenadorView.as_view(), name="vinculos"),
    path(
        "vinculos/<int:pk>/desligamento/",
        SolicitarDesligamentoCoordenadorView.as_view(),
        name="desligar-vinculo",
    ),
    path(
        "vinculos/<int:pk>/cancelar-vaga/",
        CancelarVagaView.as_view(),
        name="cancelar-vaga",
    ),
    path(
        "desligamentos/pendentes/",
        PedidosDesligamentoPendentesView.as_view(),
        name="desligamentos-pendentes",
    ),
    path(
        "desligamentos/<int:pk>/decisao/",
        DecidirDesligamentoView.as_view(),
        name="decidir-desligamento",
    ),
    path(
        "area/desligamentos/",
        DesligamentosRecentesAreaView.as_view(),
        name="desligamentos-area",
    ),
    path(
        "area/desligamentos/<int:pk>/ciencia/",
        CienciaDesligamentoView.as_view(),
        name="ciencia-desligamento",
    ),
    path(
        "area/cancelamentos/",
        CancelamentosRecentesAreaView.as_view(),
        name="cancelamentos-area",
    ),
    path(
        "area/cancelamentos/<int:pk>/ciencia/",
        CienciaCancelamentoVagaView.as_view(),
        name="ciencia-cancelamento",
    ),
    path("bolsas/", BolsasParaFinalizarView.as_view(), name="bolsas-para-finalizar"),
    path(
        "vinculos/<int:pk>/solicitar-relatorio/",
        SolicitarRelatorioView.as_view(),
        name="solicitar-relatorio",
    ),
    path(
        "vinculos/<int:pk>/relatorio-final/",
        RelatorioFinalView.as_view(),
        name="relatorio-final",
    ),
    path(
        "vinculos/<int:pk>/relatorio-final/arquivo/",
        RelatorioFinalArquivoView.as_view(),
        name="relatorio-final-arquivo",
    ),
    path("vinculos/<int:pk>/parecer/", ParecerRelatorioView.as_view(), name="parecer"),
]
