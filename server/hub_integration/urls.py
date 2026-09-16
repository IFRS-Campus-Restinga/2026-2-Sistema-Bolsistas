from django.urls import path

from .dev_auth import dev_login, dev_logout
from .views import (
    atualizar_status,
    atualizar_tipo_area,
    email_coordenador_detalhe,
    emails_coordenadores,
    listar_usuarios,
    whoami,
)

urlpatterns = [
    path("whoami/", whoami, name="hub-whoami"),
    path("usuarios/", listar_usuarios, name="hub-usuarios"),
    path("usuarios/<uuid:usuario_id>/tipo-area/", atualizar_tipo_area, name="hub-tipo-area"),
    path("usuarios/<uuid:usuario_id>/status/", atualizar_status, name="hub-usuario-status"),
    path("emails-coordenadores/", emails_coordenadores, name="hub-emails-coordenadores"),
    path(
        "emails-coordenadores/<int:entrada_id>/",
        email_coordenador_detalhe,
        name="hub-email-coordenador-detalhe",
    ),
    path("dev/login/<str:role>/", dev_login, name="dev-login"),
    path("dev/logout/", dev_logout, name="dev-logout"),
]
