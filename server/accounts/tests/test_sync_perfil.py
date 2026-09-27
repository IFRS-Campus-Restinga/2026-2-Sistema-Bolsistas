from unittest.mock import patch

from django.test import TestCase

from accounts.authentication import HubJWTAuthentication
from accounts.models import (
    CoordenadorArea,
    CoordenadorProjeto,
    EmailCoordenadorArea,
    TipoArea,
    Usuario,
)
from projetos.models import Projeto

from .helpers import cria_usuario


class SyncPerfilComProjetoProtegidoTests(TestCase):
    """Regressão: trocar o role de um usuário dono de Projeto não pode
    quebrar, mesmo com o perfil antigo (CoordenadorProjeto) protegido por
    Projeto.coordenador_projeto (on_delete=PROTECT)."""

    def setUp(self):
        self.usuario = cria_usuario(
            "coord-projeto", "cp@example.com", Usuario.Role.COORDENADOR_PROJETO
        )
        self.perfil_projeto = CoordenadorProjeto.objects.create(usuario=self.usuario)
        self.projeto = Projeto.objects.create(
            titulo="Projeto do Fulano",
            coordenador_projeto=self.perfil_projeto,
        )

    def test_sync_perfil_preserva_coordenador_projeto_dono_de_projeto(self):
        HubJWTAuthentication._sync_perfil(
            self.usuario, Usuario.Role.COORDENADOR_AREA, TipoArea.EXTENSAO
        )

        self.assertTrue(CoordenadorProjeto.objects.filter(usuario=self.usuario).exists())
        self.assertTrue(CoordenadorArea.objects.filter(usuario=self.usuario).exists())
        self.projeto.refresh_from_db()
        self.assertEqual(self.projeto.coordenador_projeto, self.perfil_projeto)

    @patch("accounts.authentication.fetch_hub_user_data")
    def test_promocao_via_email_nao_quebra_login(self, fetch_mock):
        EmailCoordenadorArea.objects.create(email="cp@example.com", tipo_area=TipoArea.EXTENSAO)
        fetch_mock.return_value = {
            "email": "cp@example.com",
            "username": "Fulano",
            "access_profile": "servidor",
        }

        usuario = HubJWTAuthentication()._sync_usuario(str(self.usuario.pk), [], "token-fake")

        self.assertEqual(usuario.role, Usuario.Role.COORDENADOR_AREA)
        self.assertTrue(CoordenadorProjeto.objects.filter(usuario=usuario).exists())
        self.assertTrue(CoordenadorArea.objects.filter(usuario=usuario).exists())
