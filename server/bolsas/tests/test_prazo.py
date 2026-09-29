from datetime import date, timedelta

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import TipoArea
from bolsas.models import Bolsa, StatusBolsa, TipoBolsa
from editais.models import Edital
from projetos.models import Projeto

from .helpers import cria_coordenador_area, cria_coordenador_projeto


class AprovacaoPrazoBolsaTests(APITestCase):
    def setUp(self):
        self.coordenador_projeto = cria_coordenador_projeto("coord_proj", "cp@test.com")
        self.coordenador_area = cria_coordenador_area(
            "coord_area", "ca@test.com", TipoArea.PESQUISA
        )
        self.projeto = Projeto.objects.create(
            titulo="Projeto A",
            coordenador_projeto=self.coordenador_projeto.perfil_coordenador_projeto,
        )

        hoje = date.today()
        self.edital_prazo_futuro = Edital.objects.create(
            nome="Edital com Prazo Futuro",
            ano_codigo="2026-001",
            link_documento_oficial="https://example.com/edital.pdf",
            status=Edital.Status.EM_VIGOR,
            data_abertura_inscricoes=hoje,
            data_fechamento_inscricoes=hoje + timedelta(days=5),
            data_homologacao=hoje + timedelta(days=10),
            data_recurso_homologacao_inicio=hoje + timedelta(days=11),
            data_recurso_homologacao_fim=hoje + timedelta(days=15),
            data_resultado=hoje + timedelta(days=20),
            data_maxima_preenchimento_vagas=hoje + timedelta(days=25),
            data_entrega_relatorios=hoje + timedelta(days=60),
        )

        self.edital_prazo_passado = Edital.objects.create(
            nome="Edital com Prazo Passado",
            ano_codigo="2026-002",
            link_documento_oficial="https://example.com/edital.pdf",
            status=Edital.Status.EM_VIGOR,
            data_abertura_inscricoes=hoje - timedelta(days=60),
            data_fechamento_inscricoes=hoje - timedelta(days=50),
            data_homologacao=hoje - timedelta(days=40),
            data_recurso_homologacao_inicio=hoje - timedelta(days=30),
            data_recurso_homologacao_fim=hoje - timedelta(days=20),
            data_resultado=hoje - timedelta(days=10),
            data_maxima_preenchimento_vagas=hoje - timedelta(days=1),
            data_entrega_relatorios=hoje + timedelta(days=30),
        )

        self.bolsa_futuro = Bolsa.objects.create(
            projeto=self.projeto,
            edital=self.edital_prazo_futuro,
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
        )

        self.bolsa_passado = Bolsa.objects.create(
            projeto=self.projeto,
            edital=self.edital_prazo_passado,
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
        )

    def test_aprova_bolsa_antes_do_prazo(self):
        self.client.force_authenticate(user=self.coordenador_area)

        resposta = self.client.post(reverse("bolsas:aprovar", args=[self.bolsa_futuro.id]))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.bolsa_futuro.refresh_from_db()
        self.assertEqual(self.bolsa_futuro.status, StatusBolsa.ABERTA)

    def test_bloqueia_aprovacao_apos_prazo(self):
        self.client.force_authenticate(user=self.coordenador_area)

        resposta = self.client.post(reverse("bolsas:aprovar", args=[self.bolsa_passado.id]))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", resposta.data)
        self.assertIn("ultrapassado", resposta.data["detail"].lower())
        self.bolsa_passado.refresh_from_db()
        self.assertEqual(self.bolsa_passado.status, StatusBolsa.SOLICITADA)

    def test_bolsa_clean_valida_transicao_preenchida(self):
        from django.core.exceptions import ValidationError

        self.bolsa_passado.status = StatusBolsa.PREENCHIDA

        with self.assertRaises(ValidationError):
            self.bolsa_passado.full_clean()

    def test_bolsa_pode_ir_para_preenchida_antes_do_prazo(self):
        self.bolsa_futuro.status = StatusBolsa.PREENCHIDA

        try:
            self.bolsa_futuro.full_clean()
        except Exception as exception:
            self.fail(f"full_clean() levantou {type(exception).__name__} inesperadamente!")
