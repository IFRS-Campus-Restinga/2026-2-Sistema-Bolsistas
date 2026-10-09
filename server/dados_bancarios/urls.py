from django.urls import path

from .views import (
    ComprovanteBancarioView,
    DadosBancariosAlunoView,
    MeusDadosBancariosView,
)

app_name = "dados_bancarios"

urlpatterns = [
    path("meus/", MeusDadosBancariosView.as_view(), name="meus"),
    path(
        "alunos/<uuid:aluno_id>/",
        DadosBancariosAlunoView.as_view(),
        name="aluno",
    ),
    path(
        "<int:pk>/comprovante/",
        ComprovanteBancarioView.as_view(),
        name="comprovante",
    ),
]
