from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Usuario
from editais.models import Edital


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
