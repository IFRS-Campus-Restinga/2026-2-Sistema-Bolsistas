from datetime import date, timedelta

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Usuario
from editais.models import AlteracaoCronograma, Edital


class DataMaximaPreenchimentoVagasTests(APITestCase):
    def setUp(self):
        self.coordenador = Usuario.objects.create_user(
            username="coordenador_prazo",
            email="prazo@example.com",
            role=Usuario.Role.COORDENADOR_AREA,
        )
        self.client.force_authenticate(user=self.coordenador)

        hoje = date.today()
        self.edital = Edital.objects.create(
            nome="Edital com Prazo",
            ano_codigo="2026-001",
            link_documento_oficial="https://example.com/edital.pdf",
            status=Edital.Status.RASCUNHO,
            data_abertura_inscricoes=hoje,
            data_fechamento_inscricoes=hoje + timedelta(days=5),
            data_homologacao=hoje + timedelta(days=10),
            data_recurso_homologacao_inicio=hoje + timedelta(days=11),
            data_recurso_homologacao_fim=hoje + timedelta(days=15),
            data_resultado=hoje + timedelta(days=20),
            data_maxima_preenchimento_vagas=hoje + timedelta(days=25),
            data_entrega_relatorios=hoje + timedelta(days=60),
        )
        self.url_detalhe = reverse("editais:detalhe", kwargs={"pk": self.edital.pk})
        self.url_publicar = reverse("editais:publicar", kwargs={"pk": self.edital.pk})

    def test_obrigatoria_ao_publicar(self):
        self.edital.data_maxima_preenchimento_vagas = None
        self.edital.save(update_fields=["data_maxima_preenchimento_vagas"])

        response = self.client.post(self.url_publicar)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("data_maxima_preenchimento_vagas", response.data)
        self.edital.refresh_from_db()
        self.assertEqual(self.edital.status, Edital.Status.RASCUNHO)

    def test_valida_ordem_entre_resultado_e_relatorios(self):
        self.edital.status = Edital.Status.EM_VIGOR
        self.edital.save(update_fields=["status"])

        hoje = date.today()
        response = self.client.patch(
            self.url_detalhe,
            {
                "data_maxima_preenchimento_vagas": (hoje + timedelta(days=65)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(
            "data_maxima_preenchimento_vagas" in response.data
            or "data_entrega_relatorios" in response.data,
            f"Esperado erro em cronograma, mas recebeu: {response.data}",
        )

    def test_prorrogacao_registra_historico(self):
        self.edital.status = Edital.Status.EM_VIGOR
        self.edital.save(update_fields=["status"])

        hoje = date.today()
        nova_data = hoje + timedelta(days=30)

        response = self.client.patch(
            self.url_detalhe,
            {"data_maxima_preenchimento_vagas": nova_data.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        historico = AlteracaoCronograma.objects.get(
            edital=self.edital, campo="data_maxima_preenchimento_vagas"
        )
        self.assertEqual(historico.responsavel, self.coordenador)
        self.assertIsNotNone(historico.alterado_em)

    def test_datas_originais_no_detalhe(self):
        self.edital.status = Edital.Status.EM_VIGOR
        self.edital.save(update_fields=["status"])

        hoje = date.today()
        nova_data = hoje + timedelta(days=30)
        self.client.patch(
            self.url_detalhe,
            {"data_maxima_preenchimento_vagas": nova_data.isoformat()},
            format="json",
        )

        response = self.client.get(self.url_detalhe)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("datas_originais", response.data)
        original = response.data["datas_originais"]["data_maxima_preenchimento_vagas"]
        self.assertIsNotNone(original)
