from django.urls import path

from .views import (
    atualizar_status,
    atualizar_tipo_area,
    email_coordenador_detalhe,
    emails_coordenadores,
    listar_usuarios,
)

urlpatterns = [
    path("usuarios/", listar_usuarios, name="admin-usuarios"),
    path("usuarios/<uuid:usuario_id>/tipo-area/", atualizar_tipo_area, name="admin-tipo-area"),
    path("usuarios/<uuid:usuario_id>/status/", atualizar_status, name="admin-usuario-status"),
    path("emails-coordenadores/", emails_coordenadores, name="admin-emails-coordenadores"),
    path(
        "emails-coordenadores/<int:entrada_id>/",
        email_coordenador_detalhe,
        name="admin-email-coordenador-detalhe",
    ),
]
