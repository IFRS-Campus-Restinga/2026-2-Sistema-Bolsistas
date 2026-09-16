from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Usuario

from .models import AlteracaoCronograma, Edital


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

    def test_outros_perfis_nao_podem_listar_nem_cadastrar(self):
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

                resposta_get = self.client.get(self.url)
                resposta_post = self.client.post(
                    self.url,
                    self.dados,
                    format="json",
                )

                self.assertEqual(
                    resposta_get.status_code,
                    status.HTTP_403_FORBIDDEN,
                )
                self.assertEqual(
                    resposta_post.status_code,
                    status.HTTP_403_FORBIDDEN,
                )

        self.assertFalse(Edital.objects.exists())

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
