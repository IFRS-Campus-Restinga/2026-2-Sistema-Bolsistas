from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CoordenadorArea, CoordenadorProjeto, TipoArea, Usuario
from auditoria.models import AcaoAuditoria, EntidadeAuditoria, LogAuditoria
from bolsas.models import Bolsa, EditalValorBolsa, StatusBolsa, TipoBolsa, TipoBolsaModalidade
from projetos.models import Projeto

from .models import AlteracaoCronograma, Edital
from .serializers import CAMPOS_CRONOGRAMA


class EditalAPITests(APITestCase):
    def setUp(self):
        self.url = reverse("editais:lista-criacao")
        self.coordenador = Usuario.objects.create_user(
            username="coordenador_teste",
            email="coordenador.teste@example.com",
            role=Usuario.Role.COORDENADOR_AREA,
        )
        self.dados = {
            "nome": "Edital de Bolsas 2026",
            "ano_codigo": "2026-001",
            "link_documento_oficial": "https://example.com/edital.pdf",
        }

    def test_coordenador_pode_cadastrar_edital(self):
        self.client.force_authenticate(user=self.coordenador)

        response = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Edital.objects.count(), 1)

        edital = Edital.objects.get()
        self.assertEqual(edital.nome, self.dados["nome"])
        self.assertEqual(edital.status, Edital.Status.RASCUNHO)
        self.assertEqual(response.data["id"], edital.id)

    def test_administrador_consulta_a_lista_com_o_total_de_bolsas(self):
        edital = Edital.objects.create(**self.dados)
        coordenador_projeto = Usuario.objects.create_user(
            username="cp", email="cp@example.com", role=Usuario.Role.COORDENADOR_PROJETO
        )
        projeto = Projeto.objects.create(
            titulo="Projeto",
            coordenador_projeto=CoordenadorProjeto.objects.create(usuario=coordenador_projeto),
        )
        Bolsa.objects.create(
            projeto=projeto,
            edital=edital,
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal="500.00",
        )
        admin = Usuario.objects.create_user(
            username="admin", email="admin@example.com", role=Usuario.Role.ADMINISTRADOR
        )
        self.client.force_authenticate(user=admin)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["total_bolsas"], 1)

    def test_administrador_nao_cadastra_edital(self):
        admin = Usuario.objects.create_user(
            username="admin", email="admin@example.com", role=Usuario.Role.ADMINISTRADOR
        )
        self.client.force_authenticate(user=admin)

        response = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cadastro_nao_permite_escolher_status(self):
        self.client.force_authenticate(user=self.coordenador)
        dados = {**self.dados, "status": Edital.Status.EM_VIGOR}

        response = self.client.post(self.url, dados, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Edital.objects.get().status, Edital.Status.RASCUNHO)

    def test_coordenador_pode_listar_editais(self):
        self.client.force_authenticate(user=self.coordenador)
        primeiro = Edital.objects.create(**self.dados)
        segundo = Edital.objects.create(
            **{
                **self.dados,
                "nome": "Outro edital",
                "ano_codigo": "2026-002",
            }
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [edital["id"] for edital in response.data],
            [segundo.id, primeiro.id],
        )

    def test_cadastro_rejeita_dados_invalidos(self):
        self.client.force_authenticate(user=self.coordenador)
        casos = [
            ("ano_codigo", "2026/3"),
            ("link_documento_oficial", "nao-e-uma-url"),
            ("nome", ""),
        ]

        for campo, valor in casos:
            with self.subTest(campo=campo):
                dados = {**self.dados, campo: valor}

                response = self.client.post(self.url, dados, format="json")

                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                self.assertIn(campo, response.data)

        self.assertFalse(Edital.objects.exists())

    def test_outros_perfis_nao_podem_cadastrar(self):
        perfis = [
            Usuario.Role.ALUNO,
            Usuario.Role.COORDENADOR_PROJETO,
            Usuario.Role.ADMINISTRADOR,
        ]

        for perfil in perfis:
            with self.subTest(perfil=perfil):
                usuario = Usuario.objects.create_user(
                    username=f"teste_{perfil}",
                    email=f"teste_{perfil.lower()}@example.com",
                    role=perfil,
                )
                self.client.force_authenticate(user=usuario)

                resposta_post = self.client.post(
                    self.url,
                    self.dados,
                    format="json",
                )

                self.assertEqual(
                    resposta_post.status_code,
                    status.HTTP_403_FORBIDDEN,
                )

        self.assertFalse(Edital.objects.exists())

    def test_aluno_nao_pode_listar(self):
        for perfil in [Usuario.Role.ALUNO]:
            with self.subTest(perfil=perfil):
                usuario = Usuario.objects.create_user(
                    username=f"teste_{perfil}",
                    email=f"teste_{perfil.lower()}@example.com",
                    role=perfil,
                )
                self.client.force_authenticate(user=usuario)

                resposta_get = self.client.get(self.url)

                self.assertEqual(resposta_get.status_code, status.HTTP_403_FORBIDDEN)

    def test_coordenador_projeto_pode_listar_para_escolher_edital_ao_solicitar_bolsa(self):
        Edital.objects.create(**self.dados, status=Edital.Status.EM_VIGOR)
        coordenador_projeto = Usuario.objects.create_user(
            username="coord_projeto_teste",
            email="coord.projeto.teste@example.com",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        self.client.force_authenticate(user=coordenador_projeto)

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

    def test_visitante_nao_pode_listar_nem_cadastrar(self):
        resposta_get = self.client.get(self.url)
        resposta_post = self.client.post(
            self.url,
            self.dados,
            format="json",
        )

        self.assertEqual(
            resposta_get.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            resposta_post.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertFalse(Edital.objects.exists())

    def test_rejeita_codigo_repetido(self):
        self.client.force_authenticate(user=self.coordenador)
        Edital.objects.create(**self.dados)

        response = self.client.post(
            self.url,
            self.dados,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ano_codigo", response.data)
        self.assertEqual(Edital.objects.count(), 1)


class CronogramaEditalAPITests(APITestCase):
    def setUp(self):
        self.coordenador = Usuario.objects.create_user(
            username="coordenador_cronograma",
            email="cronograma@example.com",
            role=Usuario.Role.COORDENADOR_AREA,
        )
        self.edital = Edital.objects.create(
            nome="Edital de Bolsas 2026",
            ano_codigo="2026-001",
            link_documento_oficial="https://example.com/edital.pdf",
            data_abertura_inscricoes="2026-09-01",
            data_fechamento_inscricoes="2026-09-10",
            data_homologacao="2026-09-15",
        )
        self.url = reverse(
            "editais:cronograma",
            kwargs={"pk": self.edital.pk},
        )
        self.client.force_authenticate(user=self.coordenador)

    def test_atualiza_apenas_a_data_enviada(self):
        response = self.client.patch(
            self.url,
            {"data_fechamento_inscricoes": "2026-09-12"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.edital.refresh_from_db()
        self.assertEqual(
            self.edital.data_fechamento_inscricoes.isoformat(),
            "2026-09-12",
        )
        self.assertEqual(
            self.edital.data_abertura_inscricoes.isoformat(),
            "2026-09-01",
        )
        self.assertEqual(
            self.edital.data_homologacao.isoformat(),
            "2026-09-15",
        )

    def test_rejeita_data_incompativel_com_datas_salvas(self):
        response = self.client.patch(
            self.url,
            {"data_fechamento_inscricoes": "2026-09-20"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("data_homologacao", response.data)

        self.edital.refresh_from_db()
        self.assertEqual(
            self.edital.data_fechamento_inscricoes.isoformat(),
            "2026-09-10",
        )

    def test_permite_etapas_no_mesmo_dia(self):
        response = self.client.patch(
            self.url,
            {"data_fechamento_inscricoes": "2026-09-15"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_bloqueia_edital_encerrado_ou_arquivado(self):
        estados = [
            Edital.Status.ENCERRADO,
            Edital.Status.ARQUIVADO,
        ]

        for estado in estados:
            with self.subTest(status_edital=estado):
                self.edital.status = estado
                self.edital.save(update_fields=["status"])

                response = self.client.patch(
                    self.url,
                    {"data_fechamento_inscricoes": "2026-09-12"},
                    format="json",
                )

                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                self.edital.refresh_from_db()
                self.assertEqual(
                    self.edital.data_fechamento_inscricoes.isoformat(),
                    "2026-09-10",
                )

    def test_outros_perfis_nao_podem_atualizar_cronograma(self):
        perfis = [
            Usuario.Role.ALUNO,
            Usuario.Role.COORDENADOR_PROJETO,
            Usuario.Role.ADMINISTRADOR,
        ]

        for perfil in perfis:
            with self.subTest(perfil=perfil):
                usuario = Usuario.objects.create_user(
                    username=f"cronograma_{perfil}",
                    email=f"cronograma_{perfil.lower()}@example.com",
                    role=perfil,
                )
                self.client.force_authenticate(user=usuario)

                response = self.client.patch(
                    self.url,
                    {"data_fechamento_inscricoes": "2026-09-12"},
                    format="json",
                )

                self.assertEqual(
                    response.status_code,
                    status.HTTP_403_FORBIDDEN,
                )

        self.edital.refresh_from_db()
        self.assertEqual(
            self.edital.data_fechamento_inscricoes.isoformat(),
            "2026-09-10",
        )

    def test_visitante_nao_pode_atualizar_cronograma(self):
        self.client.force_authenticate(user=None)

        response = self.client.patch(
            self.url,
            {"data_fechamento_inscricoes": "2026-09-12"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_retorna_404_para_edital_inexistente(self):
        edital_id = self.edital.pk
        self.edital.delete()

        url = reverse("editais:cronograma", kwargs={"pk": edital_id})
        response = self.client.patch(
            url,
            {"data_fechamento_inscricoes": "2026-09-12"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_coordenador_pode_consultar_cronograma(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["data_abertura_inscricoes"],
            "2026-09-01",
        )
        self.assertEqual(
            response.data["data_fechamento_inscricoes"],
            "2026-09-10",
        )
        self.assertIsNone(response.data["data_resultado"])


class EdicaoEditalAPITests(APITestCase):
    def setUp(self):
        self.coordenador = Usuario.objects.create_user(
            username="coordenador_edicao",
            email="edicao@example.com",
            role=Usuario.Role.COORDENADOR_AREA,
        )
        self.client.force_authenticate(user=self.coordenador)

        self.edital = Edital.objects.create(
            nome="Edital original",
            ano_codigo="2026-001",
            link_documento_oficial="https://example.com/edital.pdf",
            status=Edital.Status.EM_VIGOR,
            data_abertura_inscricoes="2026-09-01",
            data_fechamento_inscricoes="2026-09-10",
            data_homologacao="2026-09-15",
            data_recurso_homologacao_inicio="2026-09-16",
            data_recurso_homologacao_fim="2026-09-18",
            data_resultado="2026-09-20",
            data_entrega_relatorios="2026-12-01",
            data_inicio_vigencia="2026-10-01",
            data_fim_vigencia="2027-07-31",
        )
        self.url = reverse(
            "editais:detalhe",
            kwargs={"pk": self.edital.pk},
        )

    def test_edita_dados_e_datas_com_historico(self):
        response = self.client.patch(
            self.url,
            {
                "nome": "Edital atualizado",
                "data_fechamento_inscricoes": "2026-09-12",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.edital.refresh_from_db()
        self.assertEqual(self.edital.nome, "Edital atualizado")
        self.assertEqual(
            self.edital.data_fechamento_inscricoes.isoformat(),
            "2026-09-12",
        )

        historico = AlteracaoCronograma.objects.get(edital=self.edital)
        self.assertEqual(historico.campo, "data_fechamento_inscricoes")
        self.assertEqual(historico.data_anterior.isoformat(), "2026-09-10")
        self.assertEqual(historico.data_nova.isoformat(), "2026-09-12")
        self.assertEqual(historico.responsavel, self.coordenador)
        self.assertIsNotNone(historico.alterado_em)

    def test_vigencia_obrigatoria_em_edital_em_vigor(self):
        response = self.client.patch(self.url, {"data_fim_vigencia": None}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("data_fim_vigencia", response.data)

    def test_vigencia_nao_comeca_antes_do_resultado(self):
        response = self.client.patch(
            self.url, {"data_inicio_vigencia": "2026-09-19"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("data_inicio_vigencia", response.data)

    def test_fim_da_vigencia_depois_do_inicio(self):
        response = self.client.patch(self.url, {"data_fim_vigencia": "2026-10-01"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("data_fim_vigencia", response.data)

    def test_vigencia_pode_terminar_antes_da_entrega_dos_relatorios(self):
        response = self.client.patch(self.url, {"data_fim_vigencia": "2026-11-30"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_alterar_vigencia_entra_no_historico(self):
        self.client.patch(self.url, {"data_fim_vigencia": "2027-08-31"}, format="json")

        self.assertTrue(
            AlteracaoCronograma.objects.filter(
                edital=self.edital, campo="data_fim_vigencia"
            ).exists()
        )

    def test_nao_registra_historico_para_data_igual(self):
        response = self.client.patch(
            self.url,
            {"data_fechamento_inscricoes": "2026-09-10"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(AlteracaoCronograma.objects.exists())

    def test_nao_permite_apagar_data_em_vigor(self):
        response = self.client.patch(
            self.url,
            {"data_resultado": None},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("data_resultado", response.data)

        self.edital.refresh_from_db()
        self.assertEqual(
            self.edital.data_resultado.isoformat(),
            "2026-09-20",
        )
        self.assertFalse(AlteracaoCronograma.objects.exists())

    def test_cronograma_invalido_impede_toda_a_edicao(self):
        response = self.client.patch(
            self.url,
            {
                "nome": "Nome que não deve ser salvo",
                "data_fechamento_inscricoes": "2026-09-21",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.edital.refresh_from_db()
        self.assertEqual(self.edital.nome, "Edital original")
        self.assertEqual(
            self.edital.data_fechamento_inscricoes.isoformat(),
            "2026-09-10",
        )
        self.assertFalse(AlteracaoCronograma.objects.exists())

    def test_publica_rascunho_com_cronograma_completo(self):
        self.edital.status = Edital.Status.RASCUNHO
        self.edital.save(update_fields=["status"])
        EditalValorBolsa.objects.create(
            edital=self.edital,
            tipo_bolsa_modalidade=TipoBolsaModalidade.objects.first(),
            valor_mensal="350.00",
        )

        url = reverse("editais:publicar", kwargs={"pk": self.edital.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.edital.refresh_from_db()
        self.assertEqual(self.edital.status, Edital.Status.EM_VIGOR)

    def test_nao_publica_com_data_ausente(self):
        self.edital.status = Edital.Status.RASCUNHO
        self.edital.data_resultado = None
        self.edital.save(update_fields=["status", "data_resultado"])

        url = reverse("editais:publicar", kwargs={"pk": self.edital.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("data_resultado", response.data)
        self.edital.refresh_from_db()
        self.assertEqual(self.edital.status, Edital.Status.RASCUNHO)

    def test_nao_publica_cronograma_fora_de_ordem(self):
        self.edital.status = Edital.Status.RASCUNHO
        self.edital.data_fechamento_inscricoes = "2026-09-21"
        self.edital.save(update_fields=["status", "data_fechamento_inscricoes"])

        url = reverse("editais:publicar", kwargs={"pk": self.edital.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.edital.refresh_from_db()
        self.assertEqual(self.edital.status, Edital.Status.RASCUNHO)

    def test_nao_publica_edital_ja_em_vigor(self):
        url = reverse("editais:publicar", kwargs={"pk": self.edital.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_encerra_edital_em_vigor(self):
        url = reverse("editais:encerrar", kwargs={"pk": self.edital.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.edital.refresh_from_db()
        self.assertEqual(self.edital.status, Edital.Status.ENCERRADO)

    def test_nao_encerra_rascunho(self):
        self.edital.status = Edital.Status.RASCUNHO
        self.edital.save(update_fields=["status"])

        url = reverse("editais:encerrar", kwargs={"pk": self.edital.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.edital.refresh_from_db()
        self.assertEqual(self.edital.status, Edital.Status.RASCUNHO)

    def _cria_bolsa(self, status_bolsa):
        coordenador_projeto = Usuario.objects.create_user(
            username=f"coord_projeto_{status_bolsa}",
            email=f"{status_bolsa}@example.com",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        CoordenadorProjeto.objects.create(usuario=coordenador_projeto)
        projeto = Projeto.objects.create(
            titulo=f"Projeto {status_bolsa}",
            coordenador_projeto=coordenador_projeto.perfil_coordenador_projeto,
        )
        return Bolsa.objects.create(
            projeto=projeto,
            edital=self.edital,
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            status=status_bolsa,
        )

    def test_nao_encerra_edital_com_bolsa_nao_finalizada(self):
        self._cria_bolsa(StatusBolsa.ABERTA)

        url = reverse("editais:encerrar", kwargs={"pk": self.edital.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.edital.refresh_from_db()
        self.assertEqual(self.edital.status, Edital.Status.EM_VIGOR)

    def test_encerra_edital_com_bolsas_todas_finalizadas(self):
        self._cria_bolsa(StatusBolsa.CANCELADA)
        self._cria_bolsa(StatusBolsa.REJEITADA)
        self._cria_bolsa(StatusBolsa.ENCERRADA)

        url = reverse("editais:encerrar", kwargs={"pk": self.edital.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.edital.refresh_from_db()
        self.assertEqual(self.edital.status, Edital.Status.ENCERRADO)


class ValoresBolsaEditalAPITests(APITestCase):
    def setUp(self):
        self.coordenador = Usuario.objects.create_user(
            username="coord_area", email="ca@example.com", role=Usuario.Role.COORDENADOR_AREA
        )
        self.client.force_authenticate(user=self.coordenador)
        self.edital = Edital.objects.create(
            nome="Edital valores",
            ano_codigo="2026-010",
            link_documento_oficial="https://example.com/edital.pdf",
        )
        self.url = reverse("editais:valores-bolsa", kwargs={"pk": self.edital.pk})
        self.bict_12 = TipoBolsaModalidade.objects.get(modalidade="BICT", carga_horaria_semanal=12)
        self.bat_16 = TipoBolsaModalidade.objects.get(modalidade="BAT", carga_horaria_semanal=16)

    def salvar(self, *valores):
        return self.client.put(
            self.url,
            {
                "valores": [
                    {"tipo_bolsa_modalidade": tipo.id, "valor_mensal": valor}
                    for tipo, valor in valores
                ]
            },
            format="json",
        )

    def test_lista_catalogo_institucional(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 7)
        self.assertFalse(any(item["disponivel"] for item in response.data))
        bat = next(item for item in response.data if item["modalidade"] == "BAT")
        self.assertEqual(bat["carga_horaria_semanal"], 16)
        self.assertEqual(bat["valor_maximo"], "770.00")

    def test_define_modalidades_e_valores(self):
        response = self.salvar((self.bict_12, "500.00"), (self.bat_16, "770.00"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        disponiveis = {item["tipo_bolsa_modalidade"]: item for item in response.data}
        self.assertEqual(disponiveis[self.bict_12.id]["valor_mensal"], "500.00")
        self.assertTrue(disponiveis[self.bat_16.id]["disponivel"])
        self.assertEqual(EditalValorBolsa.objects.filter(edital=self.edital).count(), 2)

    def test_definir_valores_registra_log(self):
        self.salvar((self.bict_12, "500.00"))

        self.assertTrue(
            LogAuditoria.objects.filter(
                acao=AcaoAuditoria.ATUALIZACAO,
                entidade=EntidadeAuditoria.EDITAL,
                entidade_id=str(self.edital.pk),
            ).exists()
        )

    def test_valor_acima_do_maximo_institucional(self):
        response = self.salvar((self.bict_12, "600.00"))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(EditalValorBolsa.objects.exists())

    def test_alterar_valor_atualiza_bolsas_vigentes(self):
        self.salvar((self.bict_12, "500.00"))
        bolsa = self.cria_bolsa()

        self.salvar((self.bict_12, "450.00"))

        bolsa.refresh_from_db()
        self.assertEqual(str(bolsa.valor_mensal), "450.00")

    def test_nao_remove_combinacao_em_uso(self):
        self.salvar((self.bict_12, "500.00"))
        self.cria_bolsa()

        response = self.salvar((self.bat_16, "700.00"))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(
            EditalValorBolsa.objects.filter(tipo_bolsa_modalidade=self.bict_12).exists()
        )

    def test_coordenador_projeto_le_mas_nao_altera(self):
        coordenador_projeto = Usuario.objects.create_user(
            username="coord_proj", email="cp@example.com", role=Usuario.Role.COORDENADOR_PROJETO
        )
        self.client.force_authenticate(user=coordenador_projeto)

        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.salvar((self.bict_12, "500.00")).status_code, status.HTTP_403_FORBIDDEN
        )

    def test_publicar_exige_valores(self):
        Edital.objects.filter(pk=self.edital.pk).update(
            data_abertura_inscricoes="2026-09-01",
            data_fechamento_inscricoes="2026-09-10",
            data_homologacao="2026-09-15",
            data_recurso_homologacao_inicio="2026-09-16",
            data_recurso_homologacao_fim="2026-09-18",
            data_resultado="2026-09-20",
            data_entrega_relatorios="2026-12-01",
            data_inicio_vigencia="2026-10-01",
            data_fim_vigencia="2027-07-31",
        )
        publicar = reverse("editais:publicar", kwargs={"pk": self.edital.pk})

        self.assertEqual(self.client.post(publicar).status_code, status.HTTP_400_BAD_REQUEST)
        self.salvar((self.bict_12, "500.00"))
        self.assertEqual(self.client.post(publicar).status_code, status.HTTP_200_OK)

    def cria_bolsa(self):
        coordenador = Usuario.objects.create_user(
            username="dono", email="dono@example.com", role=Usuario.Role.COORDENADOR_PROJETO
        )
        perfil = CoordenadorProjeto.objects.create(usuario=coordenador)
        projeto = Projeto.objects.create(titulo="Projeto", coordenador_projeto=perfil)
        return Bolsa.objects.create(
            projeto=projeto,
            edital=self.edital,
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal="500.00",
            status=StatusBolsa.ABERTA,
        )


class CronogramaConsolidadoAPITests(APITestCase):
    def setUp(self):
        self.url = reverse("editais:cronograma-consolidado")
        self.hoje = timezone.localdate()

        self.coord_area = Usuario.objects.create_user(
            username="coord_area_pesquisa",
            email="area.pesquisa@example.com",
            role=Usuario.Role.COORDENADOR_AREA,
        )
        CoordenadorArea.objects.create(usuario=self.coord_area, tipo_area=TipoArea.PESQUISA)

        self.coord_projeto = Usuario.objects.create_user(
            username="coord_projeto_cronograma",
            email="projeto.cronograma@example.com",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        CoordenadorProjeto.objects.create(usuario=self.coord_projeto)

        self.admin = Usuario.objects.create_user(
            username="admin_cronograma",
            email="admin.cronograma@example.com",
            role=Usuario.Role.ADMINISTRADOR,
        )

        self.em_vigor = self._cria_edital("2026-001", Edital.Status.EM_VIGOR, inicio=-5)
        self.rascunho = Edital.objects.create(
            nome="Edital rascunho",
            ano_codigo="2026-002",
            link_documento_oficial="https://example.com/rascunho.pdf",
        )
        self.encerrado = self._cria_edital("2025-010", Edital.Status.ENCERRADO, inicio=-200)

    def _cria_edital(self, ano_codigo, status_edital, inicio):
        datas = [
            self.hoje + timedelta(days=inicio + passo * 3)
            for passo in range(len(CAMPOS_CRONOGRAMA))
        ]
        return Edital.objects.create(
            nome=f"Edital {ano_codigo}",
            ano_codigo=ano_codigo,
            link_documento_oficial="https://example.com/edital.pdf",
            status=status_edital,
            **dict(zip(CAMPOS_CRONOGRAMA, datas, strict=True)),
        )

    def _cria_bolsa(self, tipo, coordenador):
        projeto = Projeto.objects.create(
            titulo=f"Projeto {tipo}",
            coordenador_projeto=coordenador.perfil_coordenador_projeto,
        )
        return Bolsa.objects.create(
            projeto=projeto,
            edital=self.em_vigor,
            tipo=tipo,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            status=StatusBolsa.ABERTA,
        )

    def test_coordenador_area_ve_todos_os_editais_com_datas_chave(self):
        self.client.force_authenticate(user=self.coord_area)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [edital["id"] for edital in response.data],
            [self.encerrado.id, self.rascunho.id, self.em_vigor.id],
        )
        edital = next(item for item in response.data if item["id"] == self.em_vigor.id)
        self.assertEqual([etapa["campo"] for etapa in edital["etapas"]], CAMPOS_CRONOGRAMA)
        self.assertEqual(
            edital["etapas"][0]["data"], self.em_vigor.data_abertura_inscricoes.isoformat()
        )

    def test_coordenador_projeto_ve_apenas_editais_em_vigor(self):
        self.client.force_authenticate(user=self.coord_projeto)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([edital["id"] for edital in response.data], [self.em_vigor.id])

    def test_administrador_ve_todos_os_editais(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)

    def test_aluno_e_visitante_nao_acessam(self):
        aluno = Usuario.objects.create_user(
            username="aluno_cronograma",
            email="aluno.cronograma@example.com",
            role=Usuario.Role.ALUNO,
        )
        self.client.force_authenticate(user=aluno)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=None)
        self.assertIn(
            self.client.get(self.url).status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def test_proxima_etapa_e_a_primeira_data_a_partir_de_hoje(self):
        self.client.force_authenticate(user=self.coord_area)

        response = self.client.get(self.url)

        por_id = {edital["id"]: edital for edital in response.data}
        # Abertura em hoje-5, fechamento em hoje-2, homologação em hoje+1.
        proxima = por_id[self.em_vigor.id]["proxima_etapa"]
        self.assertEqual(proxima["campo"], "data_homologacao")
        self.assertEqual(proxima["dias"], 1)
        self.assertIsNone(por_id[self.encerrado.id]["proxima_etapa"])
        self.assertIsNone(por_id[self.rascunho.id]["proxima_etapa"])

    def test_total_de_bolsas_segue_o_tipo_do_coordenador(self):
        outro_projeto = Usuario.objects.create_user(
            username="outro_coord_projeto",
            email="outro.projeto@example.com",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        CoordenadorProjeto.objects.create(usuario=outro_projeto)
        self._cria_bolsa(TipoBolsa.PESQUISA, self.coord_projeto)
        self._cria_bolsa(TipoBolsa.INDISSOCIAVEL, outro_projeto)
        self._cria_bolsa(TipoBolsa.ENSINO, outro_projeto)

        esperado = {self.coord_area: 2, self.coord_projeto: 1, self.admin: 3}
        for usuario, total in esperado.items():
            with self.subTest(perfil=usuario.role):
                self.client.force_authenticate(user=usuario)
                response = self.client.get(self.url)
                edital = next(item for item in response.data if item["id"] == self.em_vigor.id)
                self.assertEqual(edital["total_bolsas"], total)

    def test_fases_marcam_a_atual_para_a_barra_do_cronograma(self):
        self.client.force_authenticate(user=self.coord_area)

        response = self.client.get(self.url)

        por_id = {edital["id"]: edital for edital in response.data}
        fases = por_id[self.em_vigor.id]["fases"]
        self.assertEqual(
            [fase["rotulo"] for fase in fases["fases"]],
            ["Inscrições", "Homologação", "Recursos", "Resultado", "Vigência"],
        )
        # As inscrições fecharam em hoje-2; a homologação (hoje+1) é a fase em andamento.
        self.assertEqual(fases["atual"], 1)
        self.assertEqual(por_id[self.encerrado.id]["fases"]["atual"], 5)

    def test_filtra_por_status(self):
        self.client.force_authenticate(user=self.coord_area)

        response = self.client.get(self.url, {"status": Edital.Status.RASCUNHO})
        self.assertEqual([edital["id"] for edital in response.data], [self.rascunho.id])

        response = self.client.get(self.url, {"status": "INVALIDO"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class HistoricoCronogramaAPITests(APITestCase):
    def setUp(self):
        self.url = reverse("editais:historico-cronograma")
        self.coord_area = Usuario.objects.create_user(
            username="coord_area_historico",
            email="historico@example.com",
            nome="Coordenadora Histórico",
            role=Usuario.Role.COORDENADOR_AREA,
        )
        self.edital = Edital.objects.create(
            nome="Edital com histórico",
            ano_codigo="2026-001",
            link_documento_oficial="https://example.com/edital.pdf",
            status=Edital.Status.EM_VIGOR,
            data_abertura_inscricoes="2026-09-01",
            data_fechamento_inscricoes="2026-09-10",
            data_homologacao="2026-09-15",
            data_recurso_homologacao_inicio="2026-09-16",
            data_recurso_homologacao_fim="2026-09-18",
            data_resultado="2026-09-20",
            data_entrega_relatorios="2026-12-01",
            data_inicio_vigencia="2026-10-01",
            data_fim_vigencia="2027-06-30",
        )
        self.outro_edital = Edital.objects.create(
            nome="Outro edital",
            ano_codigo="2026-002",
            link_documento_oficial="https://example.com/outro.pdf",
        )
        AlteracaoCronograma.objects.create(
            edital=self.outro_edital,
            campo="data_resultado",
            data_anterior="2026-10-01",
            data_nova="2026-10-05",
            responsavel=self.coord_area,
        )

    def _prorroga_fechamento(self):
        self.client.force_authenticate(user=self.coord_area)
        response = self.client.patch(
            reverse("editais:detalhe", kwargs={"pk": self.edital.pk}),
            {"data_fechamento_inscricoes": "2026-09-12"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_exibe_data_anterior_nova_data_responsavel_e_quando(self):
        self._prorroga_fechamento()

        response = self.client.get(self.url, {"edital": self.edital.pk})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        alteracao = response.data[0]
        self.assertEqual(alteracao["edital"], self.edital.pk)
        self.assertEqual(alteracao["campo"], "data_fechamento_inscricoes")
        self.assertEqual(alteracao["etapa"], "Fechamento das inscrições")
        self.assertEqual(alteracao["data_anterior"], "2026-09-10")
        self.assertEqual(alteracao["data_nova"], "2026-09-12")
        self.assertEqual(alteracao["responsavel_nome"], "Coordenadora Histórico")
        self.assertEqual(alteracao["responsavel_email"], "historico@example.com")
        self.assertIsNotNone(alteracao["alterado_em"])

    def test_sem_filtro_lista_todas_as_alteracoes_mais_recentes_primeiro(self):
        self._prorroga_fechamento()

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [alteracao["edital"] for alteracao in response.data],
            [self.edital.pk, self.outro_edital.pk],
        )

    def test_filtra_por_etapa(self):
        self._prorroga_fechamento()

        response = self.client.get(self.url, {"campo": "data_resultado"})
        self.assertEqual([item["edital"] for item in response.data], [self.outro_edital.pk])

        response = self.client.get(self.url, {"campo": "nome"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_alteracao_da_vigencia_tem_rotulo_proprio(self):
        self.client.force_authenticate(user=self.coord_area)
        response = self.client.patch(
            reverse("editais:detalhe", kwargs={"pk": self.edital.pk}),
            {"data_fim_vigencia": "2027-07-31"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.get(self.url, {"edital": self.edital.pk})

        self.assertEqual(response.data[0]["etapa"], "Fim da vigência")

    def test_rejeita_edital_invalido(self):
        self.client.force_authenticate(user=self.coord_area)

        response = self.client.get(self.url, {"edital": "abc"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_administrador_pode_consultar(self):
        admin = Usuario.objects.create_user(
            username="admin_historico",
            email="admin.historico@example.com",
            role=Usuario.Role.ADMINISTRADOR,
        )
        self.client.force_authenticate(user=admin)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_coordenador_projeto_e_aluno_nao_podem_consultar(self):
        for papel in (Usuario.Role.COORDENADOR_PROJETO, Usuario.Role.ALUNO):
            with self.subTest(papel=papel):
                usuario = Usuario.objects.create_user(
                    username=f"sem_acesso_{papel}",
                    email=f"{papel.lower()}@example.com",
                    role=papel,
                )
                self.client.force_authenticate(user=usuario)

                response = self.client.get(self.url)

                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
