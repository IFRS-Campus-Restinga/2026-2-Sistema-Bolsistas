import uuid

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Usuario

from .helpers import cria_usuario


class AtualizarStatusTests(TestCase):
    """PATCH /usuarios/<id>/status/ deve ativar e desativar o usuário corretamente."""

    def setUp(self):
        self.client = APIClient()
        self.admin = cria_usuario("admin", "admin@test.com", Usuario.Role.ADMINISTRADOR)
        self.usuario = cria_usuario("alvo", "alvo@test.com", Usuario.Role.ALUNO, is_active=True)
        self.client.force_authenticate(user=self.admin)

    def test_desativar_usuario_ativo(self):
        resposta = self.client.patch(
            f"/api/admin/usuarios/{self.usuario.id}/status/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(resposta.status_code, 200)
        self.usuario.refresh_from_db()
        self.assertFalse(self.usuario.is_active)

    def test_ativar_usuario_inativo(self):
        self.usuario.is_active = False
        self.usuario.save(update_fields=["is_active"])

        resposta = self.client.patch(
            f"/api/admin/usuarios/{self.usuario.id}/status/",
            {"is_active": True},
            format="json",
        )
        self.assertEqual(resposta.status_code, 200)
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.is_active)

    def test_sem_campo_is_active_retorna_400(self):
        resposta = self.client.patch(
            f"/api/admin/usuarios/{self.usuario.id}/status/",
            {},
            format="json",
        )
        self.assertEqual(resposta.status_code, 400)

    def test_is_active_como_string_retorna_400(self):
        """'false' como string não deve ser aceito — bool('false') seria True."""
        resposta = self.client.patch(
            f"/api/admin/usuarios/{self.usuario.id}/status/",
            {"is_active": "false"},
            format="json",
        )
        self.assertEqual(resposta.status_code, 400)

    def test_usuario_inexistente_retorna_404(self):
        id_inexistente = uuid.uuid4()
        resposta = self.client.patch(
            f"/api/admin/usuarios/{id_inexistente}/status/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(resposta.status_code, 404)


class TipoAreaErrosTests(TestCase):
    """PATCH /usuarios/<id>/tipo-area/ deve retornar 404 para usuários inválidos."""

    def setUp(self):
        self.client = APIClient()
        self.admin = cria_usuario("admin", "admin@test.com", Usuario.Role.ADMINISTRADOR)
        self.client.force_authenticate(user=self.admin)

    def test_usuario_inexistente_retorna_404(self):
        id_inexistente = uuid.uuid4()
        resposta = self.client.patch(
            f"/api/admin/usuarios/{id_inexistente}/tipo-area/",
            {"tipo_area": "ENSINO"},
            format="json",
        )
        self.assertEqual(resposta.status_code, 404)

    def test_usuario_nao_coordenador_area_retorna_404(self):
        """A view filtra por role=COORDENADOR_AREA; outros roles devem retornar 404."""
        aluno = cria_usuario("aluno", "aluno@test.com", Usuario.Role.ALUNO)
        resposta = self.client.patch(
            f"/api/admin/usuarios/{aluno.id}/tipo-area/",
            {"tipo_area": "ENSINO"},
            format="json",
        )
        self.assertEqual(resposta.status_code, 404)


class ListagensTests(TestCase):
    """GET /usuarios/ e GET /emails-coordenadores/ devem retornar listas corretas."""

    def setUp(self):
        self.client = APIClient()
        self.admin = cria_usuario("admin", "admin@test.com", Usuario.Role.ADMINISTRADOR)
        self.client.force_authenticate(user=self.admin)

    def test_get_usuarios_retorna_200(self):
        resposta = self.client.get("/api/admin/usuarios/")
        self.assertEqual(resposta.status_code, 200)
        self.assertIsInstance(resposta.json(), list)

    def test_get_emails_coordenadores_retorna_200(self):
        from accounts.models import EmailCoordenadorArea

        EmailCoordenadorArea.objects.create(email="coord@test.com", tipo_area="ENSINO")

        resposta = self.client.get("/api/admin/emails-coordenadores/")

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(len(resposta.json()), 1)
