import jwt
from django.conf import settings
from django.db import transaction
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from hub_integration.client import fetch_hub_user_data

from .models import Administrador, Aluno, CoordenadorArea, CoordenadorProjeto, Usuario

HUB_GROUP_ADMIN = "admin"
HUB_GROUP_COORD = "coord"
HUB_ACCESS_PROFILE_ALUNO = "aluno"

PERFIL_MODEL_POR_ROLE = {
    Usuario.Role.ALUNO: Aluno,
    Usuario.Role.COORDENADOR_PROJETO: CoordenadorProjeto,
    Usuario.Role.COORDENADOR_AREA: CoordenadorArea,
    Usuario.Role.ADMINISTRADOR: Administrador,
}


class HubJWTAuthentication(BaseAuthentication):
    def authenticate_header(self, request):
        return "Bearer"

    def authenticate(self, request):
        token = request.COOKIES.get(settings.AUTH_COOKIE_NAME)
        if not token:
            return None

        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        except jwt.PyJWTError as exc:
            raise AuthenticationFailed("Token do HUB inválido ou expirado.") from exc

        user_id = payload.get("user_id")
        if not user_id:
            raise AuthenticationFailed("Token do HUB sem user_id.")

        usuario = self._sync_usuario(user_id, payload.get("groups", []), token)

        if not usuario.is_active:
            raise AuthenticationFailed("Conta inativa.")

        return (usuario, None)

    @transaction.atomic
    def _sync_usuario(self, user_id: str, hub_groups: list[str], token: str) -> Usuario:
        usuario = Usuario.objects.filter(pk=user_id).first()
        dados_hub = fetch_hub_user_data(str(user_id), token)

        if dados_hub is None and usuario is not None:
            return usuario

        dados_hub = dados_hub or {}
        email = dados_hub.get("email")
        nome = dados_hub.get("username") or ""
        access_profile = dados_hub.get("access_profile")

        role, tipo_area = self._resolve_role(hub_groups, access_profile, email)

        if usuario is None:
            usuario = Usuario.objects.create(
                id=user_id, username=str(user_id), email=email, nome=nome, role=role
            )
        elif usuario.role != role or usuario.email != email or usuario.nome != nome:
            usuario.role, usuario.email, usuario.nome = role, email, nome
            usuario.save(update_fields=["role", "email", "nome"])

        self._sync_perfil(usuario, role, tipo_area)
        return usuario

    @staticmethod
    def _resolve_role(
        hub_groups: list[str], access_profile: str | None, email: str | None
    ) -> tuple[str, str | None]:
        if HUB_GROUP_ADMIN in hub_groups:
            return Usuario.Role.ADMINISTRADOR, None

        if access_profile == HUB_ACCESS_PROFILE_ALUNO:
            return Usuario.Role.ALUNO, None

        if HUB_GROUP_COORD in hub_groups:
            tipo_area = HubJWTAuthentication._tipo_area_por_email(email)
            if tipo_area:
                return Usuario.Role.COORDENADOR_AREA, tipo_area
            return Usuario.Role.COORDENADOR_PROJETO, None

        raise AuthenticationFailed(
            "Sua conta ainda não tem um papel definido no HUB para acessar o Sistema de Bolsistas "
            "(peça ao Administrador para configurar seu grupo de acesso)."
        )

    @staticmethod
    def _sync_perfil(usuario: Usuario, role: str, tipo_area: str | None) -> None:
        perfil_model = PERFIL_MODEL_POR_ROLE[role]

        for outro_model in PERFIL_MODEL_POR_ROLE.values():
            if outro_model is not perfil_model:
                outro_model.objects.filter(usuario=usuario).delete()

        if role == Usuario.Role.COORDENADOR_AREA:
            CoordenadorArea.objects.update_or_create(
                usuario=usuario, defaults={"tipo_area": tipo_area}
            )
        else:
            perfil_model.objects.get_or_create(usuario=usuario)

    @staticmethod
    def _tipo_area_por_email(email: str | None) -> str | None:
        if not email:
            return None
        email = email.strip().lower()
        for tipo, area_email in settings.COORDENADOR_AREA_EMAILS.items():
            if area_email and area_email.strip().lower() == email:
                return tipo
        return None
