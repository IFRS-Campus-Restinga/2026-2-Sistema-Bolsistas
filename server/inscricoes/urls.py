from django.urls import path

from .views import (
    CancelarInscricaoView,
    CandidatoDetailView,
    CandidatoListView,
    DocumentoArquivoView,
    DocumentoDeleteView,
    DocumentoListCreateView,
    EnviarInscricaoView,
    HomologarInscricaoView,
    IndeferirInscricaoView,
    InscricaoDetailView,
    InscricaoListCreateView,
    LerNotificacaoView,
)

app_name = "inscricoes"

urlpatterns = [
    path("candidatos/<int:pk>/", CandidatoDetailView.as_view(), name="candidato-detalhe"),
    path("<int:pk>/homologar/", HomologarInscricaoView.as_view(), name="homologar"),
    path("<int:pk>/indeferir/", IndeferirInscricaoView.as_view(), name="indeferir"),
    path("notificacoes/<int:pk>/ler/", LerNotificacaoView.as_view(), name="notificacao-ler"),
    path("documentos/<int:pk>/arquivo/", DocumentoArquivoView.as_view(), name="documento-arquivo"),
    path("", InscricaoListCreateView.as_view(), name="lista-criacao"),
    path("<int:pk>/", InscricaoDetailView.as_view(), name="detalhe"),
    path("<int:pk>/enviar/", EnviarInscricaoView.as_view(), name="enviar"),
    path("<int:pk>/cancelar/", CancelarInscricaoView.as_view(), name="cancelar"),
    path("<int:inscricao_pk>/documentos/", DocumentoListCreateView.as_view(), name="documentos"),
    path("documentos/<int:pk>/", DocumentoDeleteView.as_view(), name="documento-detalhe"),
    path("bolsa/<int:bolsa_pk>/candidatos/", CandidatoListView.as_view(), name="candidatos"),
]
