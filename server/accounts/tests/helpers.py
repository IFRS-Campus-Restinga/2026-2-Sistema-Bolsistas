import uuid

import jwt
from django.conf import settings

from accounts.models import Usuario

ALUNO_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
SERVIDOR_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")


def token_jwt(user_id, groups):
    payload = {"user_id": str(user_id), "groups": groups, "permissions": []}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def cria_usuario(username, email, role, is_active=True):
    return Usuario.objects.create(
        username=username,
        email=email,
        role=role,
        is_active=is_active,
    )
