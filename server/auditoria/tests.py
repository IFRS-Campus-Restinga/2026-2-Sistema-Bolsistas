# Create your tests here.
from datetime import datetime

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Usuario

from .models import AcaoAuditoria, EntidadeAuditoria, LogAuditoria
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
            acao=AcaoAuditoria.CRIACAO,
            entidade=EntidadeAuditoria.EDITAL,
            entidade_id=1,
            descricao="Edital criado.",
        )
        self.log_periodo = registrar_log(
            usuario=self.administrador,
            acao=AcaoAuditoria.ATUALIZACAO,
            entidade=EntidadeAuditoria.BOLSA,
            entidade_id=2,
            descricao="Bolsa editada.",
        )
        self.log_novo = registrar_log(
            usuario=self.administrador,
            acao=AcaoAuditoria.PUBLICACAO,
            entidade=EntidadeAuditoria.SELECAO,
            entidade_id=3,
            descricao="Resultado da seleção publicado.",
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
        self.assertEqual(log.acao, AcaoAuditoria.ATUALIZACAO)
        self.assertEqual(log.entidade, EntidadeAuditoria.BOLSA)
        self.assertEqual(log.entidade_id, "2")
        self.assertEqual(log.descricao, "Bolsa editada.")

    def test_servico_recusa_acao_ou_entidade_fora_da_lista(self):
        with self.assertRaises(ValueError):
            registrar_log(usuario=self.administrador, acao="EDITAL_PUBLICADO", entidade="EDITAL")
        with self.assertRaises(ValueError):
            registrar_log(usuario=self.administrador, acao="CRIACAO", entidade="Inscricao")

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
        self.assertEqual(response.data["count"], 3)
        self.assertEqual(response.data["results"][0]["acao"], "PUBLICACAO")
        self.assertEqual(response.data["results"][0]["acao_display"], "Publicação")
        self.assertEqual(response.data["results"][0]["entidade_display"], "Seleção")
        self.assertEqual(response.data["results"][0]["usuario_nome"], "Administrador")

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
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["acao"], "ATUALIZACAO")

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


class PaginacaoLogAuditoriaTests(APITestCase):
    def setUp(self):
        self.url = reverse("auditoria:logs")
        self.administrador = Usuario.objects.create_user(
            username="administrador",
            email="administrador@example.com",
            nome="Administrador",
            role=Usuario.Role.ADMINISTRADOR,
        )
        for i in range(25):
            registrar_log(
                usuario=self.administrador,
                acao=AcaoAuditoria.CRIACAO,
                entidade=EntidadeAuditoria.EDITAL,
                entidade_id=i,
            )
        self.client.force_authenticate(self.administrador)

    def test_primeira_pagina_traz_20_registros_e_total(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 25)
        self.assertEqual(len(response.data["results"]), 20)
        self.assertIsNotNone(response.data["next"])
        self.assertIsNone(response.data["previous"])

    def test_segunda_pagina_traz_o_restante(self):
        response = self.client.get(self.url, {"pagina": 2})

        self.assertEqual(len(response.data["results"]), 5)
        self.assertIsNone(response.data["next"])

    def test_paginas_nao_repetem_registros(self):
        pagina_1 = self.client.get(self.url, {"pagina": 1}).data["results"]
        pagina_2 = self.client.get(self.url, {"pagina": 2}).data["results"]

        ids = [log["id"] for log in pagina_1 + pagina_2]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(ids), 25)

    def test_tamanho_de_pagina_e_limitado(self):
        self.assertEqual(len(self.client.get(self.url, {"por_pagina": 10}).data["results"]), 10)
        for _ in range(80):
            registrar_log(
                usuario=self.administrador,
                acao=AcaoAuditoria.CRIACAO,
                entidade=EntidadeAuditoria.EDITAL,
            )
        self.assertEqual(len(self.client.get(self.url, {"por_pagina": 500}).data["results"]), 100)

    def test_pagina_inexistente_responde_404(self):
        self.assertEqual(self.client.get(self.url, {"pagina": 99}).status_code, 404)
