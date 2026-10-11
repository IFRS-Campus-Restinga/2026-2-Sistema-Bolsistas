from django.urls import path

from .views import (
    ClassificacaoView,
    DesempateView,
    DesistenciaVagaView,
    IndicarBolsistaView,
    LancarNotasView,
    PublicarResultadoView,
    ResultadoPublicoView,
)

app_name = "selecao"

urlpatterns = [
    path(
        "bolsas/<int:bolsa_pk>/classificacao/",
        ClassificacaoView.as_view(),
        name="classificacao",
    ),
    path(
        "bolsas/<int:bolsa_pk>/inscricoes/<int:inscricao_pk>/notas/",
        LancarNotasView.as_view(),
        name="notas",
    ),
    path("bolsas/<int:bolsa_pk>/desempate/", DesempateView.as_view(), name="desempate"),
    path(
        "bolsas/<int:bolsa_pk>/desistencias/",
        DesistenciaVagaView.as_view(),
        name="desistencias",
    ),
    path("bolsas/<int:bolsa_pk>/publicar/", PublicarResultadoView.as_view(), name="publicar"),
    path("bolsas/<int:bolsa_pk>/indicacoes/", IndicarBolsistaView.as_view(), name="indicacoes"),
    path("bolsas/<int:bolsa_pk>/resultado/", ResultadoPublicoView.as_view(), name="resultado"),
]
