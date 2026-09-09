import uuid

import jwt
from django.conf import settings
from django.http import Http404
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.authentication import HubJWTAuthentication
from accounts.models import TipoArea, Usuario

DEV_USER_IDS = {
    "admin": uuid.UUID("00000000-0000-0000-0000-000000000001"),
    "aluno": uuid.UUID("00000000-0000-0000-0000-000000000002"),
    "coordenador-projeto": uuid.UUID("00000000-0000-0000-0000-000000000003"),
    "coordenador-area": uuid.UUID("00000000-0000-0000-0000-000000000004"),
}
DEV_HUB_GROUPS = {
    "admin": ["admin"],
    "aluno": ["user"],
    "coordenador-projeto": ["coord", "user"],
    "coordenador-area": ["coord", "user"],
}
DEV_ROLE = {
    "admin": Usuario.Role.ADMINISTRADOR,
    "aluno": Usuario.Role.ALUNO,
    "coordenador-projeto": Usuario.Role.COORDENADOR_PROJETO,
    "coordenador-area": Usuario.Role.COORDENADOR_AREA,
}
DEV_TIPO_AREA = {
    "coordenador-area": TipoArea.EXTENSAO,
}


def _make_token(role: str) -> str:
    payload = {
        "user_id": str(DEV_USER_IDS[role]),
        "groups": DEV_HUB_GROUPS[role],
        "permissions": [],
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def _seed_usuario(role: str) -> Usuario:
    user_id = DEV_USER_IDS[role]
    role_valor = DEV_ROLE[role]

    usuario, _ = Usuario.objects.update_or_create(
        id=user_id,
        defaults={
            "username": str(user_id),
            "nome": f"[dev] {role_valor.label}",
            "role": role_valor,
        },
    )
    HubJWTAuthentication._sync_perfil(usuario, role_valor, DEV_TIPO_AREA.get(role))
    return usuario


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def dev_login(request, role):
    if not settings.DEBUG:
        raise Http404
    if role not in DEV_USER_IDS:
        return Response({"message": f"Papel de teste inválido: {role}"}, status=400)

    _seed_usuario(role)

    response = Response({"ok": True, "role": role})
    response.set_cookie(
        settings.AUTH_COOKIE_NAME,
        _make_token(role),
        samesite="Lax",
        path="/",
    )
    return response


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def dev_logout(request):
    if not settings.DEBUG:
        raise Http404
    response = Response({"ok": True})
    response.delete_cookie(settings.AUTH_COOKIE_NAME, path="/")
    return response
