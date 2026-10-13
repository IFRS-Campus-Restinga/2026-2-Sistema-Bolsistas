from django.urls import path

from .views import LogAuditoriaListView

app_name = "auditoria"

urlpatterns = [
    path("logs/", LogAuditoriaListView.as_view(), name="logs"),
]
