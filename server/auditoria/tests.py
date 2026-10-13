# Create your tests here.
from datetime import datetime

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Usuario

from .models import LogAuditoria
from .services import registrar_log


class LogAuditoriaTests(APITestCase):
    def setUp(self):
        self.url = reverse("auditoria:logs")

        self.administrador = Usuario.objects.create_user(
            username="administrador",
            email="administrador@example.com",
            nome="Administrador",
            role=Usuario.Role.ADMINISTRADOR,
        )
        self.aluno = Usuario.objects.create_user(
            username="aluno",
            email="aluno@example.com",
            nome="Aluno",
            role=Usuario.Role.ALUNO,
        )

        self.log_antigo = registrar_log(
            usuario=self.administrador,
            acao="CRIACAO",
            entidade="Edital",
            entidade_id=1,
            descricao="Edital criado.",
        )
        self.log_periodo = registrar_log(
            usuario=self.administrador,
            acao="EDICAO",
            entidade="Bolsa",
            entidade_id=2,
            descricao="Bolsa editada.",
        )
        self.log_novo = registrar_log(
            usuario=self.administrador,
            acao="HOMOLOGACAO",
            entidade="Inscricao",
            entidade_id=3,
            descricao="Inscrição homologada.",
        )

        LogAuditoria.objects.filter(pk=self.log_antigo.pk).update(
            data_hora=timezone.make_aware(datetime(2026, 1, 5, 10, 0))
        )
        LogAuditoria.objects.filter(pk=self.log_periodo.pk).update(
            data_hora=timezone.make_aware(datetime(2026, 1, 15, 10, 0))
        )
        LogAuditoria.objects.filter(pk=self.log_novo.pk).update(
            data_hora=timezone.make_aware(datetime(2026, 2, 5, 10, 0))
        )

    def test_servico_registra_log(self):
        log = LogAuditoria.objects.get(pk=self.log_periodo.pk)

        self.assertEqual(log.usuario, self.administrador)
        self.assertEqual(log.acao, "EDICAO")
        self.assertEqual(log.entidade, "Bolsa")
        self.assertEqual(log.entidade_id, "2")
        self.assertEqual(log.descricao, "Bolsa editada.")

    def test_visitante_nao_acessa_logs(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 401)

    def test_aluno_nao_acessa_logs(self):
        self.client.force_authenticate(self.aluno)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)

    def test_administrador_consulta_logs(self):
        self.client.force_authenticate(self.administrador)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 3)
        self.assertEqual(response.data[0]["acao"], "HOMOLOGACAO")
        self.assertEqual(response.data[0]["usuario_nome"], "Administrador")

    def test_filtra_logs_por_periodo(self):
        self.client.force_authenticate(self.administrador)

        response = self.client.get(
            self.url,
            {
                "inicio": "2026-01-10",
                "fim": "2026-01-31",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["acao"], "EDICAO")

    def test_rejeita_periodo_invertido(self):
        self.client.force_authenticate(self.administrador)

        response = self.client.get(
            self.url,
            {
                "inicio": "2026-02-01",
                "fim": "2026-01-01",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)

    def test_rejeita_data_invalida(self):
        self.client.force_authenticate(self.administrador)

        response = self.client.get(
            self.url,
            {"inicio": "data-invalida"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("inicio", response.data)

    def test_endpoint_nao_permite_criacao_manual(self):
        self.client.force_authenticate(self.administrador)

        response = self.client.post(
            self.url,
            {
                "acao": "LOG_FALSO",
                "entidade": "Sistema",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 405)
