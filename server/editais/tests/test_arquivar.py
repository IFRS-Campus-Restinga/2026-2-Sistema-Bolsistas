"""Testes de US18: arquivar edital e bloqueios pós-encerramento."""

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CoordenadorArea, CoordenadorProjeto, TipoArea, Usuario
from bolsas.models import Modalidade
from editais.models import Edital
from projetos.models import Projeto


class ArquivarEditalAPITests(APITestCase):
    def setUp(self):
        self.coordenador = Usuario.objects.create_user(
            username="coordenador_arq",
            email="arq@example.com",
            role=Usuario.Role.COORDENADOR_AREA,
        )
        CoordenadorArea.objects.create(usuario=self.coordenador, tipo_area=TipoArea.PESQUISA)
        self.client.force_authenticate(self.coordenador)

        self.edital_encerrado = Edital.objects.create(
            nome="Edital Arquivar",
            ano_codigo="2026-ARQ",
            link_documento_oficial="https://example.com",
            status=Edital.Status.ENCERRADO,
        )

    def test_arquivar_edital_encerrado_mantem_encerrado(self):
        url = reverse("editais:arquivar", kwargs={"pk": self.edital_encerrado.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.edital_encerrado.refresh_from_db()
        self.assertEqual(self.edital_encerrado.status, Edital.Status.ENCERRADO)

    def test_arquivar_edital_em_vigor_encerra(self):
        edital_vigor = Edital.objects.create(
            nome="Edital Vigor",
            ano_codigo="2026-ARV",
            link_documento_oficial="https://example.com",
            status=Edital.Status.EM_VIGOR,
        )
        url = reverse("editais:arquivar", kwargs={"pk": edital_vigor.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        edital_vigor.refresh_from_db()
        self.assertEqual(edital_vigor.status, Edital.Status.ENCERRADO)

    def test_nao_arquiva_edital_rascunho(self):
        edital_rascunho = Edital.objects.create(
            nome="Edital Rascunho Arq",
            ano_codigo="2026-ARR",
            link_documento_oficial="https://example.com",
            status=Edital.Status.RASCUNHO,
        )
        url = reverse("editais:arquivar", kwargs={"pk": edital_rascunho.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_edital_encerrado_bloqueia_nova_bolsa(self):
        """Edital encerrado recusa nova solicitação de bolsa (validate_edital exige EM_VIGOR)."""
        edital_enc = Edital.objects.create(
            nome="Edital Encerrado Bolsa",
            ano_codigo="2026-ABB",
            link_documento_oficial="https://example.com",
            status=Edital.Status.ENCERRADO,
        )
        coord_proj = Usuario.objects.create_user(
            username="coord_proj_arq",
            email="cprarq@example.com",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        CoordenadorProjeto.objects.create(usuario=coord_proj)
        projeto = Projeto.objects.create(
            titulo="Projeto Arq",
            coordenador_projeto=coord_proj.perfil_coordenador_projeto,
        )
        self.client.force_authenticate(coord_proj)
        response = self.client.post(
            "/api/bolsas/",
            {
                "projeto": projeto.pk,
                "edital": edital_enc.pk,
                "tipo": "PESQUISA",
                "modalidade": Modalidade.BICT,
                "carga_horaria_semanal": 12,
                "valor_mensal": "700.00",
                "quantidade_vagas": 1,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
