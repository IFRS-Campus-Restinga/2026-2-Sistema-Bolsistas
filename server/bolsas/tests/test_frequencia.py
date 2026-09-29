"""Testes de US15: prazo mensal de frequência — definição, lançamento e command."""

import datetime
from io import StringIO

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import TipoArea, Usuario
from bolsas.models import (
    Bolsa,
    Frequencia,
    Modalidade,
    StatusBolsa,
    StatusFrequencia,
    StatusVinculo,
    TipoBolsa,
    VinculoBolsista,
)
from editais.models import Edital
from projetos.models import Projeto

from .helpers import cria_coordenador_area, cria_coordenador_projeto, cria_edital

# ── Helpers ──────────────────────────────────────────────────────────────────


def _cria_aluno(username):
    return Usuario.objects.create(
        username=username,
        email=f"{username}@test.com",
        role=Usuario.Role.ALUNO,
    )


def _cria_projeto(coord_proj_usuario):
    return Projeto.objects.create(
        titulo="Projeto Frequência",
        coordenador_projeto=coord_proj_usuario.perfil_coordenador_projeto,
    )


def _cria_bolsa(edital, projeto, tipo=TipoBolsa.ENSINO):
    return Bolsa.objects.create(
        projeto=projeto,
        edital=edital,
        tipo=tipo,
        modalidade=Modalidade.BICT,
        carga_horaria_semanal=12,
        valor_mensal=700,
        status=StatusBolsa.ABERTA,
    )


def _cria_vinculo(bolsa, aluno):
    return VinculoBolsista.objects.create(
        bolsa=bolsa,
        aluno=aluno,
        status=StatusVinculo.ATIVO,
        data_inicio=datetime.date.today(),
    )


# ── US15 4.1 — Definir dia-limite (Coordenador de Área) ─────────────────────


class DiaLimiteFrequenciaTests(APITestCase):
    def setUp(self):
        self.coord_area = cria_coordenador_area(
            "coord_area_freq", "ca_freq@test.com", TipoArea.ENSINO
        )
        self.coord_proj = cria_coordenador_projeto("coord_proj_freq", "cp_freq@test.com")
        # RASCUNHO: não exige datas do cronograma ao editar outros campos
        self.edital = cria_edital("2026-F01", status_edital=Edital.Status.RASCUNHO)
        self.url = reverse("editais:detalhe", kwargs={"pk": self.edital.pk})

    def test_coord_area_define_dia_limite(self):
        self.client.force_authenticate(self.coord_area)
        response = self.client.patch(self.url, {"dia_limite_frequencia": 15}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.edital.refresh_from_db()
        self.assertEqual(self.edital.dia_limite_frequencia, 15)

    def test_coord_projeto_nao_pode_definir_dia_limite(self):
        self.client.force_authenticate(self.coord_proj)
        response = self.client.patch(self.url, {"dia_limite_frequencia": 15}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dia_limite_invalido_retorna_400(self):
        self.client.force_authenticate(self.coord_area)
        response = self.client.patch(self.url, {"dia_limite_frequencia": 0}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_dia_limite_maior_que_31_retorna_400(self):
        self.client.force_authenticate(self.coord_area)
        response = self.client.patch(self.url, {"dia_limite_frequencia": 32}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ── US15 4.3 — Lançar frequência (Coordenador de Projeto) ────────────────────


class LancarFrequenciaTests(APITestCase):
    def setUp(self):
        hoje = datetime.date.today()
        self.coord_proj = cria_coordenador_projeto("cp_lanc", "cp_lanc@test.com")
        self.coord_proj_outro = cria_coordenador_projeto("cp_outro", "cp_outro@test.com")
        self.aluno = _cria_aluno("aluno_freq")

        self.edital = cria_edital("2026-F02")
        # Dia limite = 28: usamos o próximo mês como mes_referencia para
        # garantir que o prazo ainda não venceu, independente do dia atual.
        self.edital.dia_limite_frequencia = 28
        self.edital.save(update_fields=["dia_limite_frequencia"])

        self.projeto = _cria_projeto(self.coord_proj)
        self.bolsa = _cria_bolsa(self.edital, self.projeto)
        self.vinculo = _cria_vinculo(self.bolsa, self.aluno)

        # Próximo mês como referência — prazo ainda não expirou
        proximo_mes_dt = (hoje.replace(day=1) + datetime.timedelta(days=32)).replace(day=1)
        self.mes_referencia = proximo_mes_dt.isoformat()

    def _url(self):
        return reverse("bolsas:lancar-frequencia", kwargs={"vinculo_pk": self.vinculo.pk})

    def test_lanca_frequencia_dentro_do_prazo(self):
        # Dia atual é <= 28, então está dentro do prazo
        self.client.force_authenticate(self.coord_proj)
        response = self.client.post(
            self._url(),
            {"mes_referencia": self.mes_referencia},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        frequencia = Frequencia.objects.get(
            vinculo=self.vinculo, mes_referencia=self.mes_referencia
        )
        self.assertEqual(frequencia.status, StatusFrequencia.INFORMADA)
        self.assertEqual(frequencia.lancada_por, self.coord_proj)

    def test_nao_pode_lancar_apos_prazo(self):
        # Simula que hoje é dia 30 e o limite é dia 5
        self.edital.dia_limite_frequencia = 5
        self.edital.save(update_fields=["dia_limite_frequencia"])

        hoje = datetime.date.today()
        # Usamos mês passado para garantir que o prazo já expirou
        mes_passado = (hoje.replace(day=1) - datetime.timedelta(days=1)).replace(day=1)

        self.client.force_authenticate(self.coord_proj)
        response = self.client.post(
            self._url(),
            {"mes_referencia": mes_passado.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_coordenador_de_outro_projeto_nao_pode_lancar(self):
        self.client.force_authenticate(self.coord_proj_outro)
        response = self.client.post(
            self._url(),
            {"mes_referencia": self.mes_referencia},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_sem_dia_limite_permite_lancar_qualquer_mes(self):
        self.edital.dia_limite_frequencia = None
        self.edital.save(update_fields=["dia_limite_frequencia"])

        hoje = datetime.date.today()
        mes_passado = (hoje.replace(day=1) - datetime.timedelta(days=1)).replace(day=1)

        self.client.force_authenticate(self.coord_proj)
        response = self.client.post(
            self._url(),
            {"mes_referencia": mes_passado.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ── US15 4.4 — Command gerar_status_frequencia ──────────────────────────────


class GerarStatusFrequenciaCommandTests(APITestCase):
    def setUp(self):
        hoje = datetime.date.today()
        self.aluno = _cria_aluno("aluno_cmd")
        self.coord_proj = cria_coordenador_projeto("cp_cmd", "cp_cmd@test.com")
        self.edital = cria_edital("2026-F03")
        self.edital.dia_limite_frequencia = 1
        self.edital.save(update_fields=["dia_limite_frequencia"])

        projeto = _cria_projeto(self.coord_proj)
        bolsa = _cria_bolsa(self.edital, projeto)
        self.vinculo = _cria_vinculo(bolsa, self.aluno)

        # Mês passado (prazo já expirou pois dia_limite=1 e hoje > dia 1)
        self.mes_passado = (hoje.replace(day=1) - datetime.timedelta(days=1)).replace(day=1)

    def test_command_gera_nao_informada_apos_prazo(self):
        stdout = StringIO()
        call_command(
            "gerar_status_frequencia",
            "--mes",
            self.mes_passado.strftime("%Y-%m"),
            stdout=stdout,
        )
        frequencia = Frequencia.objects.get(vinculo=self.vinculo, mes_referencia=self.mes_passado)
        self.assertEqual(frequencia.status, StatusFrequencia.NAO_INFORMADA)

    def test_command_idempotente(self):
        mes_str = self.mes_passado.strftime("%Y-%m")
        call_command("gerar_status_frequencia", "--mes", mes_str, stdout=StringIO())
        call_command("gerar_status_frequencia", "--mes", mes_str, stdout=StringIO())

        count = Frequencia.objects.filter(
            vinculo=self.vinculo, mes_referencia=self.mes_passado
        ).count()
        self.assertEqual(count, 1)

    def test_command_nao_altera_frequencia_ja_informada(self):
        Frequencia.objects.create(
            vinculo=self.vinculo,
            mes_referencia=self.mes_passado,
            status=StatusFrequencia.INFORMADA,
        )
        call_command(
            "gerar_status_frequencia",
            "--mes",
            self.mes_passado.strftime("%Y-%m"),
            stdout=StringIO(),
        )
        frequencia = Frequencia.objects.get(vinculo=self.vinculo, mes_referencia=self.mes_passado)
        self.assertEqual(frequencia.status, StatusFrequencia.INFORMADA)

    def test_command_ignora_vinculo_sem_dia_limite(self):
        self.edital.dia_limite_frequencia = None
        self.edital.save(update_fields=["dia_limite_frequencia"])

        call_command(
            "gerar_status_frequencia",
            "--mes",
            self.mes_passado.strftime("%Y-%m"),
            stdout=StringIO(),
        )
        self.assertFalse(
            Frequencia.objects.filter(
                vinculo=self.vinculo, mes_referencia=self.mes_passado
            ).exists()
        )
