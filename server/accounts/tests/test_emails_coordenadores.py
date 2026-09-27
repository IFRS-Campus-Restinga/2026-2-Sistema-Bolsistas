from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import CoordenadorArea, CoordenadorProjeto, EmailCoordenadorArea, Usuario
from projetos.models import Projeto

from .helpers import cria_usuario


class DeleteEmailCoordenadorRebaixaUsuarioTests(TestCase):
    """DELETE /emails-coordenadores/<id>/ deve rebaixar o usuário correspondente para COORDENADOR_PROJETO."""

    def setUp(self):
        self.client = APIClient()
        self.admin = cria_usuario("admin", "admin@test.com", Usuario.Role.ADMINISTRADOR)
        self.usuario_coord = cria_usuario(
            "coord_area", "coord.ensino@test.com", Usuario.Role.COORDENADOR_AREA
        )
        CoordenadorArea.objects.create(usuario=self.usuario_coord, tipo_area="ENSINO")
        self.entrada = EmailCoordenadorArea.objects.create(
            email="coord.ensino@test.com", tipo_area="ENSINO"
        )
        self.client.force_authenticate(user=self.admin)

    def test_delete_retorna_204(self):
        resposta = self.client.delete(f"/api/admin/emails-coordenadores/{self.entrada.id}/")
        self.assertEqual(resposta.status_code, 204)

    def test_delete_rebaixa_role_para_coordenador_projeto(self):
        self.client.delete(f"/api/admin/emails-coordenadores/{self.entrada.id}/")
        self.usuario_coord.refresh_from_db()
        self.assertEqual(self.usuario_coord.role, Usuario.Role.COORDENADOR_PROJETO)

    def test_delete_remove_perfil_coordenador_area(self):
        self.client.delete(f"/api/admin/emails-coordenadores/{self.entrada.id}/")
        self.assertFalse(CoordenadorArea.objects.filter(usuario=self.usuario_coord).exists())

    def test_delete_cria_perfil_coordenador_projeto(self):
        self.client.delete(f"/api/admin/emails-coordenadores/{self.entrada.id}/")
        self.assertTrue(CoordenadorProjeto.objects.filter(usuario=self.usuario_coord).exists())

    def test_delete_sem_usuario_correspondente_retorna_204(self):
        """Remover entrada sem usuário cadastrado ainda deve funcionar sem erros."""
        entrada_sem_usuario = EmailCoordenadorArea.objects.create(
            email="ninguem@test.com", tipo_area="PESQUISA"
        )
        resposta = self.client.delete(f"/api/admin/emails-coordenadores/{entrada_sem_usuario.id}/")
        self.assertEqual(resposta.status_code, 204)


class PostEmailCoordenadorTests(TestCase):
    """POST /emails-coordenadores/ deve criar a entrada e promover o usuário se já existir."""

    def setUp(self):
        self.client = APIClient()
        self.admin = cria_usuario("admin", "admin@test.com", Usuario.Role.ADMINISTRADOR)
        self.client.force_authenticate(user=self.admin)

    def test_post_retorna_201_e_cria_entrada(self):
        resposta = self.client.post(
            "/api/admin/emails-coordenadores/",
            {"email": "novo@test.com", "tipo_area": "ENSINO"},
            format="json",
        )
        self.assertEqual(resposta.status_code, 201)
        self.assertTrue(EmailCoordenadorArea.objects.filter(email="novo@test.com").exists())

    def test_post_promove_coordenador_projeto_existente(self):
        usuario = cria_usuario("coord", "coord@test.com", Usuario.Role.COORDENADOR_PROJETO)
        CoordenadorProjeto.objects.create(usuario=usuario)

        self.client.post(
            "/api/admin/emails-coordenadores/",
            {"email": "coord@test.com", "tipo_area": "PESQUISA"},
            format="json",
        )

        usuario.refresh_from_db()
        self.assertEqual(usuario.role, Usuario.Role.COORDENADOR_AREA)
        self.assertEqual(CoordenadorArea.objects.get(usuario=usuario).tipo_area, "PESQUISA")

    def test_post_email_duplicado_retorna_400_em_portugues(self):
        EmailCoordenadorArea.objects.create(email="existente@test.com", tipo_area="ENSINO")

        resposta = self.client.post(
            "/api/admin/emails-coordenadores/",
            {"email": "existente@test.com", "tipo_area": "PESQUISA"},
            format="json",
        )

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("Este e-mail já está cadastrado", resposta.json()["email"][0])

    def test_post_email_duplicado_case_insensitive_retorna_400(self):
        EmailCoordenadorArea.objects.create(email="existente@test.com", tipo_area="ENSINO")

        resposta = self.client.post(
            "/api/admin/emails-coordenadores/",
            {"email": "EXISTENTE@TEST.COM", "tipo_area": "PESQUISA"},
            format="json",
        )

        self.assertEqual(resposta.status_code, 400)

    def test_post_tipo_area_invalido_retorna_400(self):
        resposta = self.client.post(
            "/api/admin/emails-coordenadores/",
            {"email": "novo@test.com", "tipo_area": "INVALIDO"},
            format="json",
        )
        self.assertEqual(resposta.status_code, 400)


class PromocaoBloqueadaComProjetoTests(TestCase):
    """Promover um usuário que ainda é coordenador de um Projeto deve falhar
    com 400, não crashar (Projeto.coordenador_projeto é on_delete=PROTECT)."""

    def setUp(self):
        self.client = APIClient()
        self.admin = cria_usuario("admin", "admin@test.com", Usuario.Role.ADMINISTRADOR)
        self.client.force_authenticate(user=self.admin)

        self.usuario = cria_usuario("coord", "coord@test.com", Usuario.Role.COORDENADOR_PROJETO)
        self.perfil = CoordenadorProjeto.objects.create(usuario=self.usuario)
        Projeto.objects.create(titulo="Projeto do coord", coordenador_projeto=self.perfil)

    def test_post_email_bloqueia_promocao_com_projeto(self):
        resposta = self.client.post(
            "/api/admin/emails-coordenadores/",
            {"email": "coord@test.com", "tipo_area": "PESQUISA"},
            format="json",
        )

        self.assertEqual(resposta.status_code, 400)
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.role, Usuario.Role.COORDENADOR_PROJETO)
        self.assertFalse(EmailCoordenadorArea.objects.filter(email="coord@test.com").exists())

    def test_patch_troca_email_bloqueia_promocao_com_projeto(self):
        entrada = EmailCoordenadorArea.objects.create(email="outro@test.com", tipo_area="ENSINO")

        resposta = self.client.patch(
            f"/api/admin/emails-coordenadores/{entrada.id}/",
            {"email": "coord@test.com"},
            format="json",
        )

        self.assertEqual(resposta.status_code, 400)
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.role, Usuario.Role.COORDENADOR_PROJETO)
        entrada.refresh_from_db()
        self.assertEqual(entrada.email, "outro@test.com")


class PatchEmailCoordenadorTests(TestCase):
    """PATCH /emails-coordenadores/<id>/ deve sincronizar roles e perfis ao mudar e-mail ou tipo_area."""

    def setUp(self):
        self.client = APIClient()
        self.admin = cria_usuario("admin", "admin@test.com", Usuario.Role.ADMINISTRADOR)
        self.usuario_antigo = cria_usuario(
            "coord_antigo", "antigo@test.com", Usuario.Role.COORDENADOR_AREA
        )
        CoordenadorArea.objects.create(usuario=self.usuario_antigo, tipo_area="ENSINO")
        self.usuario_novo = cria_usuario(
            "coord_novo", "novo@test.com", Usuario.Role.COORDENADOR_PROJETO
        )
        CoordenadorProjeto.objects.create(usuario=self.usuario_novo)
        self.entrada = EmailCoordenadorArea.objects.create(
            email="antigo@test.com", tipo_area="ENSINO"
        )
        self.client.force_authenticate(user=self.admin)

    def test_patch_troca_email_rebaixa_usuario_antigo(self):
        self.client.patch(
            f"/api/admin/emails-coordenadores/{self.entrada.id}/",
            {"email": "novo@test.com"},
            format="json",
        )
        self.usuario_antigo.refresh_from_db()
        self.assertEqual(self.usuario_antigo.role, Usuario.Role.COORDENADOR_PROJETO)

    def test_patch_troca_email_promove_usuario_novo(self):
        self.client.patch(
            f"/api/admin/emails-coordenadores/{self.entrada.id}/",
            {"email": "novo@test.com"},
            format="json",
        )
        self.usuario_novo.refresh_from_db()
        self.assertEqual(self.usuario_novo.role, Usuario.Role.COORDENADOR_AREA)

    def test_patch_troca_tipo_area_atualiza_coordenador_area_do_usuario(self):
        self.client.patch(
            f"/api/admin/emails-coordenadores/{self.entrada.id}/",
            {"tipo_area": "EXTENSAO"},
            format="json",
        )
        self.assertEqual(
            CoordenadorArea.objects.get(usuario=self.usuario_antigo).tipo_area, "EXTENSAO"
        )

    def test_patch_entrada_inexistente_retorna_404(self):
        resposta = self.client.patch(
            "/api/admin/emails-coordenadores/999999/",
            {"tipo_area": "PESQUISA"},
            format="json",
        )
        self.assertEqual(resposta.status_code, 404)


class PatchTipoAreaSincronizaEmailTests(TestCase):
    """PATCH /usuarios/<id>/tipo-area/ deve atualizar o EmailCoordenadorArea correspondente."""

    def setUp(self):
        self.client = APIClient()
        self.admin = cria_usuario("admin", "admin@test.com", Usuario.Role.ADMINISTRADOR)
        self.usuario_coord = cria_usuario(
            "coord_area", "coord.ensino@test.com", Usuario.Role.COORDENADOR_AREA
        )
        CoordenadorArea.objects.create(usuario=self.usuario_coord, tipo_area="ENSINO")
        self.entrada = EmailCoordenadorArea.objects.create(
            email="coord.ensino@test.com", tipo_area="ENSINO"
        )
        self.client.force_authenticate(user=self.admin)

    def test_patch_tipo_area_retorna_200(self):
        resposta = self.client.patch(
            f"/api/admin/usuarios/{self.usuario_coord.id}/tipo-area/",
            {"tipo_area": "PESQUISA"},
            format="json",
        )
        self.assertEqual(resposta.status_code, 200)

    def test_patch_tipo_area_atualiza_perfil_coordenador_area(self):
        self.client.patch(
            f"/api/admin/usuarios/{self.usuario_coord.id}/tipo-area/",
            {"tipo_area": "PESQUISA"},
            format="json",
        )
        self.assertEqual(
            CoordenadorArea.objects.get(usuario=self.usuario_coord).tipo_area, "PESQUISA"
        )

    def test_patch_tipo_area_sincroniza_entrada_email(self):
        self.client.patch(
            f"/api/admin/usuarios/{self.usuario_coord.id}/tipo-area/",
            {"tipo_area": "EXTENSAO"},
            format="json",
        )
        self.entrada.refresh_from_db()
        self.assertEqual(self.entrada.tipo_area, "EXTENSAO")

    def test_patch_tipo_area_sincroniza_email_case_insensitive(self):
        """EmailCoordenadorArea com capitalização diferente ainda deve ser sincronizado."""
        self.entrada.email = "COORD.ENSINO@TEST.COM"
        self.entrada.save()
        self.client.patch(
            f"/api/admin/usuarios/{self.usuario_coord.id}/tipo-area/",
            {"tipo_area": "PESQUISA"},
            format="json",
        )
        self.entrada.refresh_from_db()
        self.assertEqual(self.entrada.tipo_area, "PESQUISA")
