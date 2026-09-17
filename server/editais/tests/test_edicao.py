from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CoordenadorProjeto, Usuario
from bolsas.models import Bolsa, StatusBolsa, TipoBolsa
from editais.models import AlteracaoCronograma, Edital
from projetos.models import Projeto


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
            data_maxima_preenchimento_vagas="2026-09-25",
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
