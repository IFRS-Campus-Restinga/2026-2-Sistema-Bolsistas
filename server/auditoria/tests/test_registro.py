"""Testes: cada ação de negócio gera LogEntry com ator correto."""

from auditlog.models import LogEntry
from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import TipoArea
from bolsas.models import TipoBolsa

from .helpers import (
    criar_bolsa,
    criar_coordenador_area,
    criar_coordenador_projeto,
    criar_edital,
)


class RegistroAcoesBolsaTests(APITestCase):
    """Aprovar, rejeitar e cancelar bolsa geram LogEntry."""

    def setUp(self):
        self.coordenador_area = criar_coordenador_area("coord_area_reg", TipoArea.PESQUISA)
        self.coordenador_projeto = criar_coordenador_projeto("coord_proj_reg")
        self.edital = criar_edital("2026-REG")
        self.bolsa = criar_bolsa(self.edital, self.coordenador_projeto, TipoBolsa.PESQUISA)

    def test_aprovar_bolsa_gera_log(self):
        self.client.force_authenticate(self.coordenador_area)
        url = reverse("bolsas:aprovar", kwargs={"pk": self.bolsa.pk})
        self.client.post(url)

        entradas = LogEntry.objects.filter(object_pk=str(self.bolsa.pk))
        self.assertTrue(entradas.exists())
        entrada = entradas.filter(actor=self.coordenador_area).first()
        self.assertIsNotNone(entrada)
        self.assertIn("Bolsa aprovada", str(entrada.changes))

    def test_rejeitar_bolsa_gera_log(self):
        self.client.force_authenticate(self.coordenador_area)
        url = reverse("bolsas:rejeitar", kwargs={"pk": self.bolsa.pk})
        self.client.post(url, {"justificativa": "Fora do escopo."})

        entradas = LogEntry.objects.filter(
            object_pk=str(self.bolsa.pk), actor=self.coordenador_area
        )
        self.assertTrue(entradas.exists())
        entrada = entradas.last()
        self.assertIn("Bolsa rejeitada", str(entrada.changes))

    def test_cancelar_bolsa_gera_log(self):
        self.client.force_authenticate(self.coordenador_projeto)
        url = reverse("bolsas:cancelar", kwargs={"pk": self.bolsa.pk})
        self.client.post(url, {"motivo": "Projeto descontinuado."})

        entradas = LogEntry.objects.filter(
            object_pk=str(self.bolsa.pk), actor=self.coordenador_projeto
        )
        self.assertTrue(entradas.exists())


class RegistroAcoesEditalTests(APITestCase):
    """Publicar e encerrar edital geram LogEntry."""

    def setUp(self):
        from editais.models import Edital

        self.coordenador_area = criar_coordenador_area("coord_area_ed", TipoArea.PESQUISA)
        self.edital_rascunho = criar_edital("2026-PUB", status=Edital.Status.RASCUNHO)
        self.edital_vigor = criar_edital("2026-ENC")

    def _configura_cronograma(self, edital):
        """Adiciona todas as datas obrigatórias para publicação ser válida."""
        import datetime

        from editais.models import Edital as EditalModel

        hoje = datetime.date.today()
        EditalModel.objects.filter(pk=edital.pk).update(
            data_abertura_inscricoes=hoje,
            data_fechamento_inscricoes=hoje + datetime.timedelta(days=10),
            data_homologacao=hoje + datetime.timedelta(days=15),
            data_recurso_homologacao_inicio=hoje + datetime.timedelta(days=16),
            data_recurso_homologacao_fim=hoje + datetime.timedelta(days=20),
            data_resultado=hoje + datetime.timedelta(days=25),
            data_maxima_preenchimento_vagas=hoje + datetime.timedelta(days=30),
            data_entrega_relatorios=hoje + datetime.timedelta(days=60),
        )
        edital.refresh_from_db()

    def test_publicar_edital_gera_log(self):
        self._configura_cronograma(self.edital_rascunho)
        self.client.force_authenticate(self.coordenador_area)
        url = reverse("editais:publicar", kwargs={"pk": self.edital_rascunho.pk})
        self.client.post(url)

        entradas = LogEntry.objects.filter(
            object_pk=str(self.edital_rascunho.pk), actor=self.coordenador_area
        )
        self.assertTrue(entradas.exists())

    def test_encerrar_edital_gera_log(self):
        self.client.force_authenticate(self.coordenador_area)
        url = reverse("editais:encerrar", kwargs={"pk": self.edital_vigor.pk})
        self.client.post(url)

        entradas = LogEntry.objects.filter(
            object_pk=str(self.edital_vigor.pk), actor=self.coordenador_area
        )
        self.assertTrue(entradas.exists())
