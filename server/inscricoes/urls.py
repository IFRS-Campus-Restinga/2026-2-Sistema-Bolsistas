from django.urls import path

from .views import (
    CancelarInscricaoView,
    DocumentoDeleteView,
    DocumentoListCreateView,
    EnviarInscricaoView,
    InscricaoDetailView,
    InscricaoListCreateView,
)

app_name = "inscricoes"

urlpatterns = [
    path("", InscricaoListCreateView.as_view(), name="lista-criacao"),
    path("<int:pk>/", InscricaoDetailView.as_view(), name="detalhe"),
    path("<int:pk>/enviar/", EnviarInscricaoView.as_view(), name="enviar"),
    path("<int:pk>/cancelar/", CancelarInscricaoView.as_view(), name="cancelar"),
    path("<int:inscricao_pk>/documentos/", DocumentoListCreateView.as_view(), name="documentos"),
    path("documentos/<int:pk>/", DocumentoDeleteView.as_view(), name="documento-detalhe"),
]
