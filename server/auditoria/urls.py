from django.urls import path

from .views import HistoricoCronogramaView, LogsAuditoriaView

urlpatterns = [
    path("logs/", LogsAuditoriaView.as_view(), name="auditoria-logs"),
    path(
        "editais/<int:pk>/cronograma/",
        HistoricoCronogramaView.as_view(),
        name="auditoria-cronograma",
    ),
]
