from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Aluno, CoordenadorProjeto, Usuario
from auditoria.models import AcaoAuditoria, EntidadeAuditoria, LogAuditoria
from bolsas.models import Bolsa, EtapaAvaliacao, StatusBolsa
from editais.models import Edital
from inscricoes.models import Inscricao, NotificacaoInscricao, StatusInscricao
from projetos.models import Projeto

from .models import (
    DesistenciaVaga,
    IndicacaoBolsista,
    NotaEtapa,
    PublicacaoResultado,
    ResultadoInscricao,
    SituacaoClassificacao,
)
from .services import calcular_nota_final


class CalculoNotaFinalTests(APITestCase):
    def test_media_ponderada_pelos_pesos(self):
        nota = calcular_nota_final(
            {1: Decimal("8"), 2: Decimal("6")}, {1: Decimal("70"), 2: Decimal("30")}
        )
        self.assertEqual(nota, Decimal("7.40"))

    def test_sem_nota_em_alguma_etapa_retorna_none(self):
        self.assertIsNone(
            calcular_nota_final({1: Decimal("8")}, {1: Decimal("50"), 2: Decimal("50")})
        )

    def test_pesos_zerados_usam_media_simples(self):
        nota = calcular_nota_final({1: Decimal("8"), 2: Decimal("6")}, {1: None, 2: Decimal("0")})
        self.assertEqual(nota, Decimal("7.00"))


class SelecaoBaseTests(APITestCase):
    def setUp(self):
        hoje = timezone.localdate()
        self.coordenador = self.usuario("coordenador", Usuario.Role.COORDENADOR_PROJETO)
        perfil = CoordenadorProjeto.objects.create(usuario=self.coordenador)
        projeto = Projeto.objects.create(titulo="Projeto teste", coordenador_projeto=perfil)
        self.edital = Edital.objects.create(
            nome="Edital teste",
            ano_codigo="2026-001",
            link_documento_oficial="https://example.com/edital",
            status=Edital.Status.EM_VIGOR,
            data_abertura_inscricoes=hoje - timedelta(days=20),
            data_fechamento_inscricoes=hoje - timedelta(days=10),
            data_recurso_homologacao_inicio=hoje - timedelta(days=8),
            data_recurso_homologacao_fim=hoje - timedelta(days=5),
        )
        self.bolsa = Bolsa.objects.create(
            projeto=projeto,
            edital=self.edital,
            tipo="PESQUISA",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=525,
            quantidade_vagas=1,
            nota_minima=Decimal("6.00"),
            status=StatusBolsa.ABERTA,
        )
        self.prova = EtapaAvaliacao.objects.create(
            bolsa=self.bolsa, nome="Prova", peso=Decimal("60")
        )
        self.entrevista = EtapaAvaliacao.objects.create(
            bolsa=self.bolsa, nome="Entrevista", peso=Decimal("40")
        )
        self.client.force_authenticate(self.coordenador)

    def usuario(self, nome, role=Usuario.Role.ALUNO):
        return Usuario.objects.create_user(
            username=nome, email=f"{nome}@example.com", role=role, nome=nome.title()
        )

    def candidato(self, nome, **kwargs):
        aluno = self.usuario(nome)
        Aluno.objects.create(usuario=aluno)
        dados = {"status": StatusInscricao.HOMOLOGADA, "data_envio": timezone.now()}
        dados.update(kwargs)
        return Inscricao.objects.create(aluno=aluno, bolsa=self.bolsa, **dados)

    def url(self, nome, **kwargs):
        return reverse(f"selecao:{nome}", kwargs={"bolsa_pk": self.bolsa.pk, **kwargs})

    def lancar(self, inscricao, prova, entrevista):
        return self.client.put(
            self.url("notas", inscricao_pk=inscricao.pk),
            {
                "notas": [
                    {"etapa": self.prova.id, "nota": prova},
                    {"etapa": self.entrevista.id, "nota": entrevista},
                ]
            },
            format="json",
        )

    def classificacao(self):
        resposta = self.client.get(self.url("classificacao"))
        self.assertEqual(resposta.status_code, 200, resposta.data)
        return {c["inscricao"]: c for c in resposta.data["candidatos"]}, resposta.data


class LancamentoNotasTests(SelecaoBaseTests):
    def test_lanca_notas_e_coloca_bolsa_em_selecao(self):
        inscricao = self.candidato("ana")

        resposta = self.lancar(inscricao, "8.00", "6.00")

        self.assertEqual(resposta.status_code, 200, resposta.data)
        self.assertEqual(NotaEtapa.objects.filter(inscricao=inscricao).count(), 2)
        candidato = resposta.data["candidatos"][0]
        self.assertEqual(candidato["nota_final"], "7.20")
        self.bolsa.refresh_from_db()
        self.assertEqual(self.bolsa.status, StatusBolsa.EM_SELECAO)

    def test_reedita_nota_antes_da_publicacao(self):
        inscricao = self.candidato("ana")
        self.lancar(inscricao, "8.00", "6.00")

        resposta = self.lancar(inscricao, "10.00", "10.00")

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.data["candidatos"][0]["nota_final"], "10.00")

    def test_nao_lanca_antes_do_fim_das_inscricoes(self):
        self.edital.data_fechamento_inscricoes = timezone.localdate() + timedelta(days=1)
        self.edital.save()
        inscricao = self.candidato("ana")

        resposta = self.lancar(inscricao, "8.00", "6.00")

        self.assertEqual(resposta.status_code, 400)
        self.assertFalse(NotaEtapa.objects.exists())

    def test_nao_lanca_para_inscricao_nao_homologada(self):
        inscricao = self.candidato("ana", status=StatusInscricao.INDEFERIDA)

        resposta = self.lancar(inscricao, "8.00", "6.00")

        self.assertEqual(resposta.status_code, 404)

    def test_nota_fora_da_escala_e_rejeitada(self):
        inscricao = self.candidato("ana")

        resposta = self.lancar(inscricao, "11.00", "6.00")

        self.assertEqual(resposta.status_code, 400)

    def test_etapa_de_outra_bolsa_e_rejeitada(self):
        inscricao = self.candidato("ana")
        outra = Bolsa.objects.create(
            projeto=self.bolsa.projeto,
            edital=self.edital,
            tipo="PESQUISA",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=525,
        )
        etapa_alheia = EtapaAvaliacao.objects.create(bolsa=outra, nome="X")

        resposta = self.client.put(
            self.url("notas", inscricao_pk=inscricao.pk),
            {"notas": [{"etapa": etapa_alheia.id, "nota": "5"}]},
            format="json",
        )

        self.assertEqual(resposta.status_code, 400)

    def test_outro_coordenador_nao_acessa(self):
        inscricao = self.candidato("ana")
        outro = self.usuario("outro", Usuario.Role.COORDENADOR_PROJETO)
        CoordenadorProjeto.objects.create(usuario=outro)
        self.client.force_authenticate(outro)

        resposta = self.lancar(inscricao, "8.00", "6.00")

        self.assertEqual(resposta.status_code, 404)

    def test_bloqueia_edicao_apos_publicacao(self):
        inscricao = self.candidato("ana")
        self.lancar(inscricao, "8.00", "6.00")
        self.assertEqual(self.client.post(self.url("publicar")).status_code, 200)

        resposta = self.lancar(inscricao, "9.00", "9.00")

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("publicado", resposta.data["detail"])


class ClassificacaoTests(SelecaoBaseTests):
    def test_titulares_suplentes_e_desclassificados(self):
        self.bolsa.quantidade_vagas = 2
        self.bolsa.save()
        ana, bia, caio, davi = (self.candidato(n) for n in ["ana", "bia", "caio", "davi"])
        self.lancar(ana, "9.00", "9.00")
        self.lancar(bia, "7.00", "7.00")
        self.lancar(caio, "8.00", "8.00")
        self.lancar(davi, "5.00", "5.00")

        candidatos, dados = self.classificacao()

        self.assertEqual(candidatos[ana.id]["situacao"], SituacaoClassificacao.TITULAR)
        self.assertEqual(candidatos[caio.id]["situacao"], SituacaoClassificacao.TITULAR)
        self.assertEqual(candidatos[bia.id]["situacao"], SituacaoClassificacao.SUPLENTE)
        self.assertEqual(candidatos[davi.id]["situacao"], SituacaoClassificacao.DESCLASSIFICADO)
        self.assertEqual(
            [c["inscricao"] for c in dados["candidatos"]], [ana.id, caio.id, bia.id, davi.id]
        )
        self.assertTrue(dados["pode_publicar"])

    def test_candidato_sem_todas_as_notas_impede_publicacao(self):
        ana = self.candidato("ana")
        self.client.put(
            self.url("notas", inscricao_pk=ana.pk),
            {"notas": [{"etapa": self.prova.id, "nota": "8"}]},
            format="json",
        )

        candidatos, dados = self.classificacao()

        self.assertIsNone(candidatos[ana.id]["situacao"])
        self.assertFalse(dados["pode_publicar"])
        self.assertEqual(self.client.post(self.url("publicar")).status_code, 400)

    def test_empate_exige_desempate_do_coordenador(self):
        ana, bia = self.candidato("ana"), self.candidato("bia")
        self.lancar(ana, "8.00", "8.00")
        self.lancar(bia, "8.00", "8.00")

        candidatos, dados = self.classificacao()
        self.assertTrue(candidatos[ana.id]["empate_pendente"])
        self.assertFalse(dados["pode_publicar"])

        resposta = self.client.post(
            self.url("desempate"), {"inscricoes": [bia.id, ana.id]}, format="json"
        )

        self.assertEqual(resposta.status_code, 200, resposta.data)
        candidatos, dados = self.classificacao()
        self.assertEqual(candidatos[bia.id]["situacao"], SituacaoClassificacao.TITULAR)
        self.assertEqual(candidatos[ana.id]["situacao"], SituacaoClassificacao.SUPLENTE)
        self.assertTrue(dados["pode_publicar"])

    def test_desempate_precisa_incluir_todo_o_grupo(self):
        ana, bia, caio = self.candidato("ana"), self.candidato("bia"), self.candidato("caio")
        for inscricao in (ana, bia, caio):
            self.lancar(inscricao, "8.00", "8.00")

        resposta = self.client.post(
            self.url("desempate"), {"inscricoes": [bia.id, ana.id]}, format="json"
        )

        self.assertEqual(resposta.status_code, 400)

    def test_mudar_nota_desfaz_desempate(self):
        ana, bia = self.candidato("ana"), self.candidato("bia")
        self.lancar(ana, "8.00", "8.00")
        self.lancar(bia, "8.00", "8.00")
        self.client.post(self.url("desempate"), {"inscricoes": [bia.id, ana.id]}, format="json")

        self.lancar(ana, "7.00", "7.00")
        self.lancar(ana, "8.00", "8.00")

        candidatos, _ = self.classificacao()
        self.assertTrue(candidatos[ana.id]["empate_pendente"])

    def test_recurso_em_andamento_impede_publicacao(self):
        self.edital.data_recurso_homologacao_fim = timezone.localdate()
        self.edital.save()
        ana = self.candidato("ana")
        self.lancar(ana, "8.00", "8.00")

        resposta = self.client.post(self.url("publicar"))

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("recursos", resposta.data["detail"])


class PublicacaoEIndicacaoTests(SelecaoBaseTests):
    def setUp(self):
        super().setUp()
        self.ana, self.bia, self.cris = (self.candidato(n) for n in ["ana", "bia", "cris"])
        self.caio = self.candidato("caio")
        self.indeferido = self.candidato("davi", status=StatusInscricao.INDEFERIDA)
        self.lancar(self.ana, "9.00", "9.00")
        self.lancar(self.bia, "8.00", "8.00")
        self.lancar(self.cris, "7.50", "7.50")
        self.lancar(self.caio, "7.00", "7.00")

    def publicar(self):
        resposta = self.client.post(self.url("publicar"))
        self.assertEqual(resposta.status_code, 200, resposta.data)
        return resposta

    def indicar(self, inscricao, justificativa=""):
        return self.client.post(
            self.url("indicacoes"),
            {"inscricao": inscricao.id, "justificativa": justificativa},
            format="json",
        )

    def nao_assumiu(self, inscricao, motivo="Aceitou estágio em outra instituição."):
        return self.client.post(
            self.url("desistencias"),
            {"inscricao": inscricao.id, "motivo": motivo},
            format="json",
        )

    def test_publicacao_gera_resultado_e_notifica_candidatos(self):
        self.publicar()

        self.assertTrue(PublicacaoResultado.objects.filter(bolsa=self.bolsa).exists())
        self.assertEqual(ResultadoInscricao.objects.count(), 4)
        self.assertTrue(
            NotificacaoInscricao.objects.filter(
                inscricao=self.ana, mensagem__contains="Titular"
            ).exists()
        )

    def test_publicacao_indicacao_e_desistencia_geram_log(self):
        self.publicar()
        self.nao_assumiu(self.ana)
        self.indicar(self.bia)

        def registrado(acao, entidade):
            return LogAuditoria.objects.filter(
                acao=acao, entidade=entidade, entidade_id=str(self.bolsa.pk)
            ).count()

        self.assertEqual(registrado(AcaoAuditoria.PUBLICACAO, EntidadeAuditoria.SELECAO), 1)
        self.assertEqual(registrado(AcaoAuditoria.DESISTENCIA, EntidadeAuditoria.BOLSA), 1)
        self.assertEqual(registrado(AcaoAuditoria.VINCULO, EntidadeAuditoria.BOLSA), 1)

    def test_nao_publica_duas_vezes(self):
        self.publicar()

        self.assertEqual(self.client.post(self.url("publicar")).status_code, 400)

    def test_resultado_visivel_a_todos_os_candidatos_da_bolsa(self):
        self.publicar()
        self.client.force_authenticate(self.indeferido.aluno)

        resposta = self.client.get(self.url("resultado"))

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(
            [r["aluno_nome"] for r in resposta.data["resultados"]],
            ["Ana", "Bia", "Cris", "Caio"],
        )

    def test_resultado_nao_visivel_para_quem_nao_e_candidato(self):
        self.publicar()
        self.client.force_authenticate(self.usuario("estranho"))

        self.assertEqual(self.client.get(self.url("resultado")).status_code, 403)

    def test_resultado_nao_publicado_nao_aparece(self):
        self.client.force_authenticate(self.ana.aluno)

        self.assertEqual(self.client.get(self.url("resultado")).status_code, 400)

    def test_inscricao_do_aluno_mostra_situacao(self):
        self.publicar()
        self.client.force_authenticate(self.ana.aluno)

        resposta = self.client.get(reverse("inscricoes:detalhe", kwargs={"pk": self.ana.pk}))

        self.assertEqual(resposta.data["resultado_selecao"]["situacao"], "TITULAR")
        self.assertFalse(resposta.data["resultado_selecao"]["nao_assumiu"])

    def test_titular_e_indicado_sem_justificativa_e_preenche_a_bolsa(self):
        self.publicar()

        resposta = self.indicar(self.ana)

        self.assertEqual(resposta.status_code, 200, resposta.data)
        self.assertTrue(IndicacaoBolsista.objects.filter(inscricao=self.ana).exists())
        self.bolsa.refresh_from_db()
        self.assertEqual(self.bolsa.status, StatusBolsa.PREENCHIDA)
        self.assertEqual(self.indicar(self.bia, "Outra").status_code, 400)

    def test_nao_indica_antes_da_publicacao(self):
        self.assertEqual(self.indicar(self.ana).status_code, 400)

    def test_suplente_nao_ocupa_vaga_reservada_ao_titular(self):
        self.publicar()

        resposta = self.indicar(self.bia, "Prefiro a Bia.")

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("titulares", resposta.data["detail"])
        candidatos, _ = self.classificacao()
        self.assertFalse(candidatos[self.bia.id]["pode_indicar"])

    def test_titular_que_nao_assume_libera_vaga_ao_primeiro_suplente(self):
        self.publicar()

        resposta = self.nao_assumiu(self.ana)

        self.assertEqual(resposta.status_code, 200, resposta.data)
        self.assertTrue(DesistenciaVaga.objects.filter(inscricao=self.ana).exists())
        self.assertTrue(
            NotificacaoInscricao.objects.filter(
                inscricao=self.ana, mensagem__contains="não vai assumir"
            ).exists()
        )
        self.assertEqual(self.indicar(self.bia).status_code, 200)
        self.bolsa.refresh_from_db()
        self.assertEqual(self.bolsa.status, StatusBolsa.PREENCHIDA)

    def test_justificativa_obrigatoria_ao_pular_a_fila(self):
        self.publicar()
        self.nao_assumiu(self.ana)

        resposta = self.indicar(self.cris)

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("justificativa", resposta.data)
        self.assertEqual(self.indicar(self.cris, "Bia sem horário.").status_code, 200)
        self.assertEqual(
            IndicacaoBolsista.objects.get(inscricao=self.cris).justificativa, "Bia sem horário."
        )

    def test_suplente_preterido_continua_disponivel(self):
        self.bolsa.quantidade_vagas = 2
        self.bolsa.save()
        dani = self.candidato("dani")
        self.lancar(dani, "6.50", "6.50")
        self.publicar()
        self.nao_assumiu(self.ana)
        self.assertEqual(self.indicar(dani, "Perfil mais adequado.").status_code, 200)

        candidatos, _ = self.classificacao()
        self.assertFalse(candidatos[self.cris.id]["pode_indicar"])  # vaga restante é da Bia

        self.nao_assumiu(self.bia)
        candidatos, _ = self.classificacao()
        self.assertTrue(candidatos[self.cris.id]["pode_indicar"])
        self.assertFalse(candidatos[self.cris.id]["exige_justificativa_indicacao"])

    def test_pulado_volta_a_ser_o_proximo_da_fila(self):
        self.bolsa.quantidade_vagas = 2
        self.bolsa.save()
        self.publicar()
        self.indicar(self.ana)
        self.nao_assumiu(self.bia)

        candidatos, _ = self.classificacao()

        self.assertFalse(candidatos[self.cris.id]["exige_justificativa_indicacao"])
        self.assertTrue(candidatos[self.caio.id]["exige_justificativa_indicacao"])
        self.assertTrue(candidatos[self.bia.id]["desistencia"])
        self.assertFalse(candidatos[self.bia.id]["pode_indicar"])

    def test_suplente_nao_pode_ser_marcado_como_nao_assume(self):
        self.publicar()

        resposta = self.nao_assumiu(self.bia)

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("titular", resposta.data["detail"])
        candidatos, _ = self.classificacao()
        self.assertFalse(candidatos[self.bia.id]["pode_registrar_desistencia"])
        self.assertTrue(candidatos[self.ana.id]["pode_registrar_desistencia"])

    def test_aluno_ve_resultado_sem_notas(self):
        self.publicar()
        self.client.force_authenticate(self.bia.aluno)

        resposta = self.client.get(self.url("resultado"))

        self.assertFalse(resposta.data["mostra_notas"])
        self.assertNotIn("nota_final", resposta.data["resultados"][0])

    def test_coordenador_ve_resultado_com_notas(self):
        self.publicar()

        resposta = self.client.get(self.url("resultado"))

        self.assertEqual(resposta.data["resultados"][0]["nota_final"], "9.00")

    def test_nao_assumiu_exige_motivo(self):
        self.publicar()

        self.assertEqual(self.nao_assumiu(self.ana, motivo="  ").status_code, 400)
        self.assertFalse(DesistenciaVaga.objects.exists())

    def test_nao_assumiu_nao_vale_para_indicado_nem_antes_da_publicacao(self):
        self.assertEqual(self.nao_assumiu(self.ana).status_code, 400)
        self.publicar()
        self.indicar(self.ana)

        self.assertEqual(self.nao_assumiu(self.ana).status_code, 400)

    def test_aluno_ve_que_nao_assumiu(self):
        self.publicar()
        self.nao_assumiu(self.ana)
        self.client.force_authenticate(self.ana.aluno)

        resposta = self.client.get(reverse("inscricoes:detalhe", kwargs={"pk": self.ana.pk}))

        self.assertTrue(resposta.data["resultado_selecao"]["nao_assumiu"])
