from django.urls import path

from .views import (
    AprovarBolsaView,
    BolsaDetailView,
    BolsaDisponivelDetailView,
    BolsaListCreateView,
    BolsasDisponiveisView,
    CancelarBolsaView,
    RejeitarBolsaView,
)

app_name = "bolsas"

urlpatterns = [
    path("", BolsaListCreateView.as_view(), name="lista-criacao"),
    path("disponiveis/", BolsasDisponiveisView.as_view(), name="disponiveis"),
    path("disponiveis/<int:pk>/", BolsaDisponivelDetailView.as_view(), name="disponivel-detalhe"),
    path("<int:pk>/", BolsaDetailView.as_view(), name="detalhe"),
    path("<int:pk>/aprovar/", AprovarBolsaView.as_view(), name="aprovar"),
    path("<int:pk>/rejeitar/", RejeitarBolsaView.as_view(), name="rejeitar"),
    path("<int:pk>/cancelar/", CancelarBolsaView.as_view(), name="cancelar"),
]
