from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import CoordenadorArea, EmailCoordenadorArea, TipoArea, Usuario
from auditoria.models import LogAuditoria


class AuditoriaAcoesAdministradorTests(APITestCase):
    def setUp(self):
        self.administrador = Usuario.objects.create_user(
            username="admin_auditoria",
            email="admin_auditoria@example.com",
            nome="Administrador",
            role=Usuario.Role.ADMINISTRADOR,
        )
        self.usuario = Usuario.objects.create_user(
            username="usuario_auditado",
            email="usuario_auditado@example.com",
            nome="Usuário Auditado",
            role=Usuario.Role.ALUNO,
        )
        self.client.force_authenticate(self.administrador)

    def test_alteracao_de_status_do_usuario_gera_log(self):
        response = self.client.patch(
            reverse("admin-usuario-status", args=[self.usuario.pk]),
            {"is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        log = LogAuditoria.objects.get(acao="USUARIO_DESATIVADO")
        self.assertEqual(log.usuario, self.administrador)
        self.assertEqual(log.entidade_id, str(self.usuario.pk))

    def test_alteracao_de_area_do_coordenador_gera_log(self):
        coordenador = Usuario.objects.create_user(
            username="coordenador_auditado",
            email="coordenador_auditado@example.com",
            nome="Coordenador Auditado",
            role=Usuario.Role.COORDENADOR_AREA,
        )
        CoordenadorArea.objects.create(usuario=coordenador, tipo_area=TipoArea.ENSINO)

        response = self.client.patch(
            reverse("admin-tipo-area", args=[coordenador.pk]),
            {"tipo_area": TipoArea.PESQUISA},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(LogAuditoria.objects.filter(acao="AREA_COORDENADOR_ATUALIZADA").exists())

    def test_cadastro_de_email_de_coordenador_gera_log(self):
        response = self.client.post(
            reverse("admin-emails-coordenadores"),
            {"email": "coordenador_novo@example.com", "tipo_area": TipoArea.EXTENSAO},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(LogAuditoria.objects.filter(acao="EMAIL_COORDENADOR_CADASTRADO").exists())

    def test_atualizacao_e_remocao_de_email_geram_logs(self):
        entrada = EmailCoordenadorArea.objects.create(
            email="coordenador_existente@example.com",
            tipo_area=TipoArea.ENSINO,
        )
        url = reverse("admin-email-coordenador-detalhe", args=[entrada.pk])

        response = self.client.patch(
            url,
            {"tipo_area": TipoArea.PESQUISA},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(LogAuditoria.objects.filter(acao="EMAIL_COORDENADOR_ATUALIZADO").exists())

        response = self.client.delete(url)
        self.assertEqual(response.status_code, 204)
        self.assertTrue(LogAuditoria.objects.filter(acao="EMAIL_COORDENADOR_REMOVIDO").exists())
