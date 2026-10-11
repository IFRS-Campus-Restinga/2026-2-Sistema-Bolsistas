from django.urls import path

from .views import (
    AceitarConviteView,
    AprovarConviteView,
    BolsasElegiveisView,
    BuscaAlunoView,
    CancelarConviteView,
    ConviteCoordenadorDetailView,
    ConviteDetailView,
    ConviteListCreateView,
    DocumentoConviteArquivoView,
    DocumentoConviteDeleteView,
    DocumentoConviteListCreateView,
    EnviarConviteView,
    LerNotificacaoConviteView,
    MeusConvitesView,
    NotificacaoConviteListView,
    RecusarConviteView,
    RejeitarConviteView,
)

app_name = "vinculo_direto"

urlpatterns = [
    path("bolsas-elegiveis/", BolsasElegiveisView.as_view(), name="bolsas-elegiveis"),
    path("alunos-busca/", BuscaAlunoView.as_view(), name="alunos-busca"),
    path("notificacoes/", NotificacaoConviteListView.as_view(), name="notificacoes"),
    path("notificacoes/<int:pk>/ler/", LerNotificacaoConviteView.as_view(), name="notificacao-ler"),
    path(
        "documentos/<int:pk>/arquivo/",
        DocumentoConviteArquivoView.as_view(),
        name="documento-arquivo",
    ),
    path("documentos/<int:pk>/", DocumentoConviteDeleteView.as_view(), name="documento-detalhe"),
    path("meus-convites/", MeusConvitesView.as_view(), name="meus-convites"),
    path("convites/", ConviteListCreateView.as_view(), name="convites"),
    path("convites/<int:pk>/", ConviteDetailView.as_view(), name="convite-detalhe"),
    path(
        "convites/<int:pk>/coordenador/",
        ConviteCoordenadorDetailView.as_view(),
        name="convite-coordenador-detalhe",
    ),
    path("convites/<int:pk>/cancelar/", CancelarConviteView.as_view(), name="convite-cancelar"),
    path("convites/<int:pk>/aceitar/", AceitarConviteView.as_view(), name="convite-aceitar"),
    path("convites/<int:pk>/recusar/", RecusarConviteView.as_view(), name="convite-recusar"),
    path("convites/<int:pk>/enviar/", EnviarConviteView.as_view(), name="convite-enviar"),
    path("convites/<int:pk>/aprovar/", AprovarConviteView.as_view(), name="convite-aprovar"),
    path("convites/<int:pk>/rejeitar/", RejeitarConviteView.as_view(), name="convite-rejeitar"),
    path(
        "convites/<int:convite_pk>/documentos/",
        DocumentoConviteListCreateView.as_view(),
        name="convite-documentos",
    ),
]
