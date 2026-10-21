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


class CenarioComTresLogs(APITestCase):
    def setUp(self):
        self.url = reverse("auditoria:logs")
        self.ana = Usuario.objects.create_user(
            username="ana",
            email="ana.admin@ifrs.edu.br",
            nome="Ana Souza",
            role=Usuario.Role.ADMINISTRADOR,
        )
        self.bruno = Usuario.objects.create_user(
            username="bruno",
            email="bruno.coord@ifrs.edu.br",
            nome="Bruno Lima",
            role=Usuario.Role.COORDENADOR_AREA,
        )
        registrar_log(
            usuario=self.ana,
            acao=AcaoAuditoria.ATIVACAO,
            entidade=EntidadeAuditoria.USUARIO,
            descricao="Usuário Duda Reichert ativado.",
        )
        registrar_log(
            usuario=self.bruno,
            acao=AcaoAuditoria.PUBLICACAO,
            entidade=EntidadeAuditoria.EDITAL,
            descricao='Edital "2026-1" publicado.',
        )
        registrar_log(
            usuario=self.ana,
            acao=AcaoAuditoria.CANCELAMENTO,
            entidade=EntidadeAuditoria.BOLSA,
            descricao='Bolsa do projeto "Robótica" cancelada.',
        )
        self.client.force_authenticate(self.ana)


class FiltrosLogAuditoriaTests(CenarioComTresLogs):
    def descricoes(self, **filtros):
        resposta = self.client.get(self.url, filtros)
        self.assertEqual(resposta.status_code, 200, resposta.data)
        return sorted(log["descricao"] for log in resposta.data["results"])

    def test_filtra_por_acao_e_por_entidade(self):
        self.assertEqual(self.descricoes(acao="PUBLICACAO"), ['Edital "2026-1" publicado.'])
        self.assertEqual(
            self.descricoes(entidade="BOLSA"), ['Bolsa do projeto "Robótica" cancelada.']
        )

    def test_filtra_usuario_por_parte_do_nome_ou_do_email(self):
        self.assertEqual(len(self.descricoes(usuario="souza")), 2)
        self.assertEqual(self.descricoes(usuario="BRUNO.COORD"), ['Edital "2026-1" publicado.'])

    def test_filtra_descricao_por_trecho_sem_diferenciar_maiusculas(self):
        self.assertEqual(
            self.descricoes(descricao="duda reichert"), ["Usuário Duda Reichert ativado."]
        )

    def test_combina_filtros(self):
        self.assertEqual(
            self.descricoes(usuario="ana", entidade="BOLSA"),
            ['Bolsa do projeto "Robótica" cancelada.'],
        )
        self.assertEqual(self.descricoes(usuario="ana", acao="PUBLICACAO"), [])

    def test_recusa_acao_ou_entidade_desconhecida(self):
        self.assertEqual(self.client.get(self.url, {"acao": "INVENTADA"}).status_code, 400)
        self.assertEqual(self.client.get(self.url, {"entidade": "Inscricao"}).status_code, 400)

    def test_opcoes_trazem_todas_as_acoes_e_entidades_com_rotulo(self):
        resposta = self.client.get(reverse("auditoria:opcoes"))

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(len(resposta.data["acoes"]), len(AcaoAuditoria.choices))
        self.assertEqual(len(resposta.data["entidades"]), len(EntidadeAuditoria.choices))
        self.assertIn({"valor": "VINCULO", "rotulo": "Vínculo"}, resposta.data["acoes"])

    def test_opcoes_sao_restritas_ao_administrador(self):
        self.client.force_authenticate(self.bruno)
        self.assertEqual(self.client.get(reverse("auditoria:opcoes")).status_code, 403)


class AutorCopiadoNoLogTests(APITestCase):
    def test_log_mantem_autor_mesmo_se_o_usuario_for_removido(self):
        autor = Usuario.objects.create_user(
            username="carla",
            email="carla@ifrs.edu.br",
            nome="Carla Dias",
            role=Usuario.Role.ADMINISTRADOR,
        )
        log = registrar_log(
            usuario=autor, acao=AcaoAuditoria.ATIVACAO, entidade=EntidadeAuditoria.USUARIO
        )
        autor.delete()

        log.refresh_from_db()
        self.assertIsNone(log.usuario)
        self.assertEqual(log.usuario_nome, "Carla Dias")

        leitor = Usuario.objects.create_user(
            username="leitor",
            email="leitor@ifrs.edu.br",
            nome="Leitor",
            role=Usuario.Role.ADMINISTRADOR,
        )
        self.client.force_authenticate(leitor)
        resposta = self.client.get(reverse("auditoria:logs"), {"usuario": "carla"})
        self.assertEqual(resposta.data["count"], 1)
        self.assertEqual(resposta.data["results"][0]["usuario_nome"], "Carla Dias")


class ExportacaoLogsTests(CenarioComTresLogs):
    def exportar(self, **filtros):
        return self.client.get(reverse("auditoria:exportar"), filtros)

    def test_exporta_csv_com_cabecalho_e_bom(self):
        resposta = self.exportar()

        self.assertEqual(resposta.status_code, 200)
        self.assertIn("text/csv", resposta["Content-Type"])
        self.assertIn("attachment", resposta["Content-Disposition"])
        conteudo = resposta.content.decode("utf-8")
        self.assertTrue(conteudo.startswith("﻿"))
        linhas = conteudo.lstrip("﻿").strip().splitlines()
        self.assertEqual(linhas[0], "Data e hora;Ação;Usuário;E-mail;Entidade;ID;Descrição")
        self.assertEqual(len(linhas), 4)

    def test_exportacao_respeita_os_filtros(self):
        conteudo = self.exportar(acao="PUBLICACAO").content.decode("utf-8")
        linhas = conteudo.lstrip("﻿").strip().splitlines()

        self.assertEqual(len(linhas), 2)
        self.assertIn("Publicação", linhas[1])

    def test_exportacao_restrita_ao_administrador(self):
        self.client.force_authenticate(self.bruno)
        self.assertEqual(self.exportar().status_code, 403)

    def test_opcoes_informam_a_data_do_servidor(self):
        resposta = self.client.get(reverse("auditoria:opcoes"))
        self.assertEqual(resposta.data["hoje"], timezone.localdate().isoformat())
