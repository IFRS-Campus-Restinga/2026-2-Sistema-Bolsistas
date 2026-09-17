from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import CoordenadorProjeto, EmailCoordenadorArea, Usuario

from .helpers import cria_usuario


class AdminEndpointsPermissaoTests(TestCase):
    """Qualquer role que não seja ADMINISTRADOR deve receber 403 em todos os endpoints de admin."""

    def setUp(self):
        self.client = APIClient()
        self.admin = cria_usuario("admin", "admin@test.com", Usuario.Role.ADMINISTRADOR)
        self.coordenador = cria_usuario("coord", "coord@test.com", Usuario.Role.COORDENADOR_PROJETO)
        CoordenadorProjeto.objects.create(usuario=self.coordenador)
        self.entrada = EmailCoordenadorArea.objects.create(email="x@test.com", tipo_area="ENSINO")

    def _todos_endpoints(self):
        coord_id = self.coordenador.id
        entrada_id = self.entrada.id
        return [
            ("get", "/api/admin/usuarios/"),
            ("patch", f"/api/admin/usuarios/{coord_id}/tipo-area/"),
            ("patch", f"/api/admin/usuarios/{coord_id}/status/"),
            ("get", "/api/admin/emails-coordenadores/"),
            ("post", "/api/admin/emails-coordenadores/"),
            ("patch", f"/api/admin/emails-coordenadores/{entrada_id}/"),
            ("delete", f"/api/admin/emails-coordenadores/{entrada_id}/"),
        ]

    def test_nao_autenticado_recebe_401(self):
        for metodo, url in self._todos_endpoints():
            with self.subTest(metodo=metodo, url=url):
                resposta = getattr(self.client, metodo)(url, format="json")
                self.assertEqual(resposta.status_code, 401)

    def test_coordenador_projeto_recebe_403(self):
        self.client.force_authenticate(user=self.coordenador)
        for metodo, url in self._todos_endpoints():
            with self.subTest(metodo=metodo, url=url):
                resposta = getattr(self.client, metodo)(url, format="json")
                self.assertEqual(resposta.status_code, 403)
