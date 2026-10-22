import os
from datetime import timedelta
from importlib import import_module
from tempfile import TemporaryDirectory

from django.apps import apps
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import CoordenadorArea, CoordenadorProjeto, TipoArea, Usuario
from auditoria.models import AcaoAuditoria, EntidadeAuditoria, LogAuditoria
from bolsas.models import Bolsa, StatusBolsa
from editais.models import Edital
from inscricoes.models import Inscricao, Recurso, StatusInscricao, StatusRecurso
from projetos.models import Projeto
from selecao.models import IndicacaoBolsista, PublicacaoResultado
from vinculo_direto.models import ConviteVinculoDireto, StatusConvite

from .models import OrigemVinculo, RelatorioFinal, SituacaoRelatorio, VinculoBolsista

migracao_vinculos = import_module("bolsistas.migrations.0002_vinculos_existentes")


class CenarioBolsista(APITestCase):
    def setUp(self):
        pasta_media = TemporaryDirectory()
        self.addCleanup(pasta_media.cleanup)
        media = override_settings(MEDIA_ROOT=pasta_media.name)
        media.enable()
        self.addCleanup(media.disable)

        self.coordenador = Usuario.objects.create_user(
            username="coordenador",
            email="coordenador@example.com",
            nome="Coordenador",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        projeto = Projeto.objects.create(
            titulo="Projeto",
            coordenador_projeto=CoordenadorProjeto.objects.create(usuario=self.coordenador),
        )
        self.edital = Edital.objects.create(
            nome="Edital",
            ano_codigo="2026-001",
            link_documento_oficial="https://example.com/edital",
            status=Edital.Status.EM_VIGOR,
        )
        self.bolsa = Bolsa.objects.create(
            projeto=projeto,
            edital=self.edital,
            tipo="ENSINO",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            quantidade_vagas=3,
            status=StatusBolsa.PREENCHIDA,
        )

    def aluno(self, nome):
        return Usuario.objects.create_user(
            username=nome, email=f"{nome}@example.com", nome=nome, role=Usuario.Role.ALUNO
        )

    def indicacao(self, aluno):
        inscricao = Inscricao.objects.create(
            aluno=aluno, bolsa=self.bolsa, status=StatusInscricao.HOMOLOGADA
        )
        return IndicacaoBolsista.objects.create(
            bolsa=self.bolsa, inscricao=inscricao, responsavel=self.coordenador
        )

    def vinculo(self, nome="ana"):
        aluno = self.aluno(nome)
        return VinculoBolsista.objects.create(
            bolsa=self.bolsa,
            aluno=aluno,
            origem=OrigemVinculo.SELECAO,
            indicacao=self.indicacao(aluno),
        )

    def coordenador_de_area(self, nome, tipo_area):
        usuario = Usuario.objects.create_user(
            username=nome,
            email=f"{nome}@example.com",
            nome=nome,
            role=Usuario.Role.COORDENADOR_AREA,
        )
        CoordenadorArea.objects.create(usuario=usuario, tipo_area=tipo_area)
        return usuario

    def relatorio(self, vinculo, situacao=SituacaoRelatorio.AGUARDANDO_AVALIACAO):
        """Relatório coerente com a situação: solicitado não tem arquivo; avaliado tem avaliador."""
        enviado = situacao != SituacaoRelatorio.SOLICITADO
        avaliado = situacao in (SituacaoRelatorio.APROVADO, SituacaoRelatorio.REPROVADO)
        return RelatorioFinal.objects.create(
            vinculo=vinculo,
            solicitado_por=self.coordenador,
            situacao=situacao,
            arquivo=pdf() if enviado else "",
            enviado_em=timezone.now() if enviado else None,
            justificativa="Ajustar." if situacao == SituacaoRelatorio.REPROVADO else "",
            avaliado_por=self.coordenador if avaliado else None,
            avaliado_em=timezone.now() if avaliado else None,
        )

    def convite(self, aluno, status):
        return ConviteVinculoDireto.objects.create(
            bolsa=self.bolsa, aluno=aluno, coordenador_solicitante=self.coordenador, status=status
        )


class RegrasDoVinculoTests(CenarioBolsista):
    def test_origem_precisa_corresponder_ao_registro_de_origem(self):
        convite = self.convite(self.aluno("ana"), StatusConvite.APROVADO)

        with self.assertRaises(IntegrityError):
            VinculoBolsista.objects.create(
                bolsa=self.bolsa, aluno=convite.aluno, origem=OrigemVinculo.SELECAO, convite=convite
            )

    def test_aluno_tem_um_vinculo_por_bolsa(self):
        aluno = self.aluno("ana")
        VinculoBolsista.objects.create(
            bolsa=self.bolsa,
            aluno=aluno,
            origem=OrigemVinculo.SELECAO,
            indicacao=self.indicacao(aluno),
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            VinculoBolsista.objects.create(
                bolsa=self.bolsa,
                aluno=aluno,
                origem=OrigemVinculo.VINCULO_DIRETO,
                convite=self.convite(aluno, StatusConvite.APROVADO),
            )


class MigracaoVinculosExistentesTests(CenarioBolsista):
    def test_cria_vinculos_de_indicacoes_e_convites_aprovados(self):
        indicado = self.aluno("ana")
        convidado = self.aluno("bia")
        indicacao = self.indicacao(indicado)
        convite = self.convite(convidado, StatusConvite.APROVADO)
        self.convite(self.aluno("cris"), StatusConvite.ENVIADO)

        migracao_vinculos.criar_vinculos_existentes(apps, None)
        migracao_vinculos.criar_vinculos_existentes(apps, None)

        self.assertEqual(VinculoBolsista.objects.count(), 2)
        self.assertEqual(VinculoBolsista.objects.get(indicacao=indicacao).aluno, indicado)
        vinculo_convite = VinculoBolsista.objects.get(convite=convite)
        self.assertEqual(vinculo_convite.aluno, convidado)
        self.assertEqual(vinculo_convite.origem, OrigemVinculo.VINCULO_DIRETO)


def pdf(nome="relatorio.pdf"):
    return SimpleUploadedFile(nome, b"%PDF-1.4 teste", content_type="application/pdf")


class RelatorioFinalTests(CenarioBolsista):
    def setUp(self):
        super().setUp()
        self.vinculo_ana = self.vinculo("ana")

    def criar(self, **campos):
        return RelatorioFinal.objects.create(
            vinculo=self.vinculo_ana, solicitado_por=self.coordenador, **campos
        )

    def test_relatorio_nasce_solicitado_sem_arquivo_e_aceita_envio(self):
        relatorio = self.criar()

        self.assertEqual(relatorio.situacao, SituacaoRelatorio.SOLICITADO)
        self.assertFalse(relatorio.arquivo)
        self.assertTrue(relatorio.aceita_envio)

    def test_relatorio_aprovado_nao_aceita_envio(self):
        relatorio = self.relatorio(self.vinculo_ana, SituacaoRelatorio.APROVADO)

        self.assertFalse(relatorio.aceita_envio)

    def test_solicitado_nao_tem_arquivo(self):
        with self.assertRaises(IntegrityError):
            self.criar(arquivo=pdf(), enviado_em=timezone.now())

    def test_enviado_exige_arquivo_e_data(self):
        with self.assertRaises(IntegrityError):
            self.criar(situacao=SituacaoRelatorio.AGUARDANDO_AVALIACAO)

    def test_aguardando_avaliacao_nao_tem_avaliador(self):
        with self.assertRaises(IntegrityError):
            self.criar(
                situacao=SituacaoRelatorio.AGUARDANDO_AVALIACAO,
                arquivo=pdf(),
                enviado_em=timezone.now(),
                avaliado_por=self.coordenador,
                avaliado_em=timezone.now(),
            )

    def test_parecer_exige_avaliador_e_data(self):
        with self.assertRaises(IntegrityError):
            self.criar(
                situacao=SituacaoRelatorio.APROVADO, arquivo=pdf(), enviado_em=timezone.now()
            )

    def test_reprovado_exige_justificativa(self):
        with self.assertRaises(IntegrityError):
            self.criar(
                situacao=SituacaoRelatorio.REPROVADO,
                arquivo=pdf(),
                enviado_em=timezone.now(),
                avaliado_por=self.coordenador,
                avaliado_em=timezone.now(),
            )

    def test_apagar_relatorio_remove_arquivo_do_disco(self):
        relatorio = self.relatorio(self.vinculo_ana)
        caminho = relatorio.arquivo.path
        self.assertTrue(os.path.exists(caminho))

        relatorio.delete()

        self.assertFalse(os.path.exists(caminho))


class EnvioRelatorioTests(CenarioBolsista):
    def setUp(self):
        super().setUp()
        self.definir_prazo(dias=10)
        self.vinculo_ana = self.vinculo("ana")
        self.relatorio(self.vinculo_ana, SituacaoRelatorio.SOLICITADO)
        self.client.force_authenticate(self.vinculo_ana.aluno)

    def definir_prazo(self, dias):
        prazo = None if dias is None else timezone.localdate() + timedelta(days=dias)
        self.edital.data_entrega_relatorios = prazo
        self.edital.save(update_fields=["data_entrega_relatorios"])

    def url(self, vinculo=None):
        vinculo = vinculo or self.vinculo_ana
        return reverse("bolsistas:relatorio-final", kwargs={"pk": vinculo.pk})

    def enviar(self, arquivo=None, vinculo=None):
        return self.client.post(
            self.url(vinculo), {"arquivo": arquivo or pdf()}, format="multipart"
        )

    def avaliar(self, situacao, justificativa=""):
        RelatorioFinal.objects.filter(vinculo=self.vinculo_ana).update(
            situacao=situacao,
            justificativa=justificativa,
            avaliado_por=self.coordenador,
            avaliado_em=timezone.now(),
        )

    def test_envia_relatorio_dentro_do_prazo(self):
        response = self.enviar(pdf("meu-relatorio.pdf"))

        self.assertEqual(response.status_code, 200, response.data)
        relatorio = RelatorioFinal.objects.get(vinculo=self.vinculo_ana)
        self.assertEqual(relatorio.situacao, SituacaoRelatorio.AGUARDANDO_AVALIACAO)
        self.assertEqual(relatorio.nome_original, "meu-relatorio.pdf")
        self.assertTrue(os.path.exists(relatorio.arquivo.path))
        self.assertEqual(response.data["situacao"], SituacaoRelatorio.AGUARDANDO_AVALIACAO)

    def test_ultimo_dia_do_prazo_ainda_aceita(self):
        self.definir_prazo(dias=0)

        self.assertEqual(self.enviar().status_code, 200)

    def test_bloqueia_apos_o_prazo(self):
        self.definir_prazo(dias=-1)

        response = self.enviar()

        self.assertEqual(response.status_code, 400)
        self.assertIn("prazo de entrega", response.data["detail"])
        self.assertEqual(RelatorioFinal.objects.get().situacao, SituacaoRelatorio.SOLICITADO)

    def test_bloqueia_edital_sem_prazo(self):
        self.definir_prazo(dias=None)

        response = self.enviar()

        self.assertEqual(response.status_code, 400)
        self.assertIn("não define o prazo", response.data["detail"])

    def test_bloqueia_sem_solicitacao_do_coordenador(self):
        RelatorioFinal.objects.all().delete()

        response = self.enviar()

        self.assertEqual(response.status_code, 400)
        self.assertIn("ainda não solicitou", response.data["detail"])

    def test_aceita_somente_pdf(self):
        imagem = SimpleUploadedFile("relatorio.png", b"imagem", content_type="image/png")

        self.assertEqual(self.enviar(imagem).status_code, 400)

    def test_limita_tamanho_do_arquivo(self):
        grande = SimpleUploadedFile(
            "relatorio.pdf", b"0" * (10 * 1024 * 1024 + 1), content_type="application/pdf"
        )

        self.assertEqual(self.enviar(grande).status_code, 400)

    def test_aluno_nao_envia_relatorio_de_outro_vinculo(self):
        outro = self.vinculo("bia")

        self.assertEqual(self.enviar(vinculo=outro).status_code, 404)

    def test_coordenador_nao_envia_relatorio(self):
        self.client.force_authenticate(self.coordenador)

        self.assertEqual(self.enviar().status_code, 403)

    def test_reenvio_antes_da_avaliacao_substitui_o_arquivo(self):
        self.enviar(pdf("versao-1.pdf"))
        caminho_anterior = RelatorioFinal.objects.get().arquivo.path

        response = self.enviar(pdf("versao-2.pdf"))

        self.assertEqual(response.status_code, 200)
        relatorio = RelatorioFinal.objects.get()
        self.assertEqual(relatorio.nome_original, "versao-2.pdf")
        self.assertFalse(os.path.exists(caminho_anterior))
        self.assertTrue(os.path.exists(relatorio.arquivo.path))

    def test_reenvio_apos_reprovacao_volta_para_avaliacao(self):
        self.enviar()
        self.avaliar(SituacaoRelatorio.REPROVADO, "Faltou descrever as atividades.")

        response = self.enviar(pdf("corrigido.pdf"))

        self.assertEqual(response.status_code, 200)
        relatorio = RelatorioFinal.objects.get()
        self.assertEqual(relatorio.situacao, SituacaoRelatorio.AGUARDANDO_AVALIACAO)
        self.assertEqual(relatorio.justificativa, "")
        self.assertIsNone(relatorio.avaliado_por)
        self.assertIsNone(relatorio.avaliado_em)

    def test_relatorio_aprovado_nao_pode_ser_reenviado(self):
        self.enviar()
        self.avaliar(SituacaoRelatorio.APROVADO)

        response = self.enviar()

        self.assertEqual(response.status_code, 400)
        self.assertIn("já foi aprovado", response.data["detail"])

    def test_aluno_baixa_o_proprio_relatorio(self):
        self.enviar(pdf("meu-relatorio.pdf"))
        url = reverse("bolsistas:relatorio-final-arquivo", kwargs={"pk": self.vinculo_ana.pk})

        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertIn("meu-relatorio.pdf", response["Content-Disposition"])
        self.assertEqual(b"".join(response.streaming_content), b"%PDF-1.4 teste")

    def test_aluno_nao_baixa_relatorio_de_outro(self):
        self.enviar()
        self.client.force_authenticate(self.vinculo("bia").aluno)
        url = reverse("bolsistas:relatorio-final-arquivo", kwargs={"pk": self.vinculo_ana.pk})

        self.assertEqual(self.client.get(url).status_code, 404)


class MeusVinculosTests(CenarioBolsista):
    url = reverse("bolsistas:meus-vinculos")

    def setUp(self):
        super().setUp()
        self.prazo = timezone.localdate() + timedelta(days=5)
        self.edital.data_entrega_relatorios = self.prazo
        self.edital.save(update_fields=["data_entrega_relatorios"])
        self.vinculo_ana = self.vinculo("ana")
        self.vinculo("bia")
        self.client.force_authenticate(self.vinculo_ana.aluno)

    def test_lista_somente_os_vinculos_do_aluno(self):
        with self.assertNumQueries(1):
            response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [self.vinculo_ana.pk])
        item = response.data[0]
        self.assertEqual(item["projeto_titulo"], "Projeto")
        self.assertEqual(item["coordenador_nome"], "Coordenador")
        self.assertEqual(item["origem"], OrigemVinculo.SELECAO)
        self.assertEqual(item["prazo_relatorio"], self.prazo.isoformat())

    def test_sem_solicitacao_nao_pode_enviar(self):
        item = self.client.get(self.url).data[0]

        self.assertIsNone(item["relatorio"])
        self.assertFalse(item["pode_enviar_relatorio"])
        self.assertIn("ainda não solicitou", item["motivo_bloqueio"])

    def test_relatorio_solicitado_pode_enviar(self):
        self.relatorio(self.vinculo_ana, SituacaoRelatorio.SOLICITADO)

        item = self.client.get(self.url).data[0]

        self.assertEqual(item["relatorio"]["situacao"], SituacaoRelatorio.SOLICITADO)
        self.assertIsNone(item["relatorio"]["arquivo"])
        self.assertTrue(item["pode_enviar_relatorio"])
        self.assertEqual(item["motivo_bloqueio"], "")

    def test_relatorio_aprovado_bloqueia_envio_com_motivo(self):
        self.relatorio(self.vinculo_ana, SituacaoRelatorio.APROVADO)

        item = self.client.get(self.url).data[0]

        self.assertEqual(item["relatorio"]["situacao"], SituacaoRelatorio.APROVADO)
        self.assertFalse(item["pode_enviar_relatorio"])
        self.assertIn("já foi aprovado", item["motivo_bloqueio"])

    def test_prazo_vencido_bloqueia_envio(self):
        self.relatorio(self.vinculo_ana, SituacaoRelatorio.SOLICITADO)
        self.edital.data_entrega_relatorios = timezone.localdate() - timedelta(days=1)
        self.edital.save(update_fields=["data_entrega_relatorios"])

        item = self.client.get(self.url).data[0]

        self.assertFalse(item["pode_enviar_relatorio"])
        self.assertIn("terminou", item["motivo_bloqueio"])

    def test_somente_aluno_acessa(self):
        self.client.force_authenticate(self.coordenador)

        self.assertEqual(self.client.get(self.url).status_code, 403)


class ParecerRelatorioTests(CenarioBolsista):
    def setUp(self):
        super().setUp()
        self.vinculo_ana = self.vinculo("ana")
        self.relatorio_ana = self.relatorio(self.vinculo_ana)
        self.client.force_authenticate(self.coordenador)

    def avaliar(self, situacao, justificativa="", vinculo=None):
        vinculo = vinculo or self.vinculo_ana
        return self.client.post(
            reverse("bolsistas:parecer", kwargs={"pk": vinculo.pk}),
            {"situacao": situacao, "justificativa": justificativa},
            format="json",
        )

    def outro_coordenador(self):
        usuario = Usuario.objects.create_user(
            username="outro",
            email="outro@example.com",
            nome="Outro",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        CoordenadorProjeto.objects.create(usuario=usuario)
        return usuario

    def test_aprova_relatorio(self):
        response = self.avaliar(SituacaoRelatorio.APROVADO)

        self.assertEqual(response.status_code, 200, response.data)
        self.relatorio_ana.refresh_from_db()
        self.assertEqual(self.relatorio_ana.situacao, SituacaoRelatorio.APROVADO)
        self.assertEqual(self.relatorio_ana.avaliado_por, self.coordenador)
        self.assertIsNotNone(self.relatorio_ana.avaliado_em)

    def test_reprova_com_justificativa(self):
        response = self.avaliar(SituacaoRelatorio.REPROVADO, "  Faltou o cronograma.  ")

        self.assertEqual(response.status_code, 200)
        self.relatorio_ana.refresh_from_db()
        self.assertEqual(self.relatorio_ana.situacao, SituacaoRelatorio.REPROVADO)
        self.assertEqual(self.relatorio_ana.justificativa, "Faltou o cronograma.")

    def test_aprovacao_registra_log(self):
        self.avaliar(SituacaoRelatorio.APROVADO)

        log = LogAuditoria.objects.get()
        self.assertEqual(log.acao, AcaoAuditoria.APROVACAO)
        self.assertEqual(log.entidade, EntidadeAuditoria.RELATORIO_FINAL)
        self.assertEqual(log.entidade_id, str(self.relatorio_ana.pk))
        self.assertEqual(log.usuario, self.coordenador)
        self.assertIn("ana", log.descricao)

    def test_reprovacao_registra_log_com_justificativa(self):
        self.avaliar(SituacaoRelatorio.REPROVADO, "Faltou o cronograma.")

        log = LogAuditoria.objects.get()
        self.assertEqual(log.acao, AcaoAuditoria.REJEICAO)
        self.assertIn("Faltou o cronograma.", log.descricao)

    def test_parecer_recusado_nao_registra_log(self):
        self.avaliar(SituacaoRelatorio.REPROVADO, "")

        self.assertFalse(LogAuditoria.objects.exists())

    def test_reprovar_exige_justificativa(self):
        response = self.avaliar(SituacaoRelatorio.REPROVADO, "   ")

        self.assertEqual(response.status_code, 400)
        self.assertIn("justificativa", response.data)

    def test_nao_aceita_situacao_aguardando(self):
        self.assertEqual(self.avaliar(SituacaoRelatorio.AGUARDANDO_AVALIACAO).status_code, 400)

    def test_nao_avalia_relatorio_ja_avaliado(self):
        self.avaliar(SituacaoRelatorio.APROVADO)

        response = self.avaliar(SituacaoRelatorio.REPROVADO, "Mudei de ideia.")

        self.assertEqual(response.status_code, 400)
        self.assertIn("não está aguardando", response.data["detail"])

    def test_relatorio_solicitado_ainda_sem_arquivo(self):
        bia = self.vinculo("bia")
        self.relatorio(bia, SituacaoRelatorio.SOLICITADO)

        response = self.avaliar(SituacaoRelatorio.APROVADO, vinculo=bia)

        self.assertEqual(response.status_code, 400)
        self.assertIn("não está aguardando", response.data["detail"])

    def test_sem_relatorio_enviado(self):
        sem_relatorio = self.vinculo("bia")

        self.assertEqual(
            self.avaliar(SituacaoRelatorio.APROVADO, vinculo=sem_relatorio).status_code, 404
        )

    def test_coordenador_de_outro_projeto_nao_avalia(self):
        self.client.force_authenticate(self.outro_coordenador())

        self.assertEqual(self.avaliar(SituacaoRelatorio.APROVADO).status_code, 404)

    def test_aluno_nao_avalia(self):
        self.client.force_authenticate(self.vinculo_ana.aluno)

        self.assertEqual(self.avaliar(SituacaoRelatorio.APROVADO).status_code, 403)

    def test_coordenador_do_projeto_baixa_o_relatorio(self):
        url = reverse("bolsistas:relatorio-final-arquivo", kwargs={"pk": self.vinculo_ana.pk})

        response = self.client.get(url)
        response.close()
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(self.outro_coordenador())
        self.assertEqual(self.client.get(url).status_code, 404)


class BolsistasDoCoordenadorTests(CenarioBolsista):
    url = reverse("bolsistas:vinculos")

    def setUp(self):
        super().setUp()
        self.vinculo_bia = self.vinculo("bia")
        self.vinculo_ana = self.vinculo("ana")
        self.relatorio(self.vinculo_ana)
        self.edital.data_entrega_relatorios = timezone.localdate() + timedelta(days=5)
        self.edital.save(update_fields=["data_entrega_relatorios"])
        self.client.force_authenticate(self.coordenador)

    def test_lista_bolsistas_dos_projetos_do_coordenador(self):
        with self.assertNumQueries(1):
            response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["aluno_nome"] for item in response.data], ["ana", "bia"])
        ana, bia = response.data
        self.assertEqual(ana["relatorio"]["situacao"], SituacaoRelatorio.AGUARDANDO_AVALIACAO)
        self.assertIsNone(bia["relatorio"])
        self.assertEqual(ana["projeto_titulo"], "Projeto")
        self.assertFalse(ana["pode_solicitar_relatorio"])
        self.assertTrue(bia["pode_solicitar_relatorio"])

    def test_coordenador_de_outro_projeto_nao_ve_os_bolsistas(self):
        outro = Usuario.objects.create_user(
            username="outro",
            email="outro@example.com",
            nome="Outro",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        CoordenadorProjeto.objects.create(usuario=outro)
        self.client.force_authenticate(outro)

        self.assertEqual(self.client.get(self.url).data, [])

    def test_aluno_nao_acessa(self):
        self.client.force_authenticate(self.vinculo_ana.aluno)

        self.assertEqual(self.client.get(self.url).status_code, 403)


class FinalizarBolsaTests(CenarioBolsista):
    def setUp(self):
        super().setUp()
        self.coordenador_area = self.coordenador_de_area("area", TipoArea.ENSINO)
        self.vinculo_ana = self.vinculo("ana")
        self.vinculo_bia = self.vinculo("bia")
        # Bolsistas indicados pressupõem o resultado da seleção publicado.
        PublicacaoResultado.objects.create(bolsa=self.bolsa, responsavel=self.coordenador)
        self.client.force_authenticate(self.coordenador_area)

    def finalizar(self):
        return self.client.post(reverse("bolsas:finalizar", kwargs={"pk": self.bolsa.pk}))

    def test_finaliza_com_todos_os_relatorios_aprovados(self):
        self.relatorio(self.vinculo_ana, SituacaoRelatorio.APROVADO)
        self.relatorio(self.vinculo_bia, SituacaoRelatorio.APROVADO)

        response = self.finalizar()

        self.assertEqual(response.status_code, 200, response.data)
        self.bolsa.refresh_from_db()
        self.assertEqual(self.bolsa.status, StatusBolsa.ENCERRADA)
        log = LogAuditoria.objects.get()
        self.assertEqual(log.acao, AcaoAuditoria.ENCERRAMENTO)
        self.assertEqual(log.entidade, EntidadeAuditoria.BOLSA)
        self.assertEqual(log.usuario, self.coordenador_area)

    def test_lista_os_relatorios_pendentes(self):
        self.relatorio(self.vinculo_ana, SituacaoRelatorio.AGUARDANDO_AVALIACAO)

        response = self.finalizar()

        self.assertEqual(response.status_code, 400)
        self.assertIn("ana (aguardando avaliação)", response.data["detail"])
        self.assertIn("bia (não solicitado)", response.data["detail"])
        self.bolsa.refresh_from_db()
        self.assertEqual(self.bolsa.status, StatusBolsa.PREENCHIDA)
        self.assertFalse(LogAuditoria.objects.exists())

    def test_relatorio_solicitado_e_nao_enviado_impede_finalizar(self):
        self.relatorio(self.vinculo_ana, SituacaoRelatorio.APROVADO)
        self.relatorio(self.vinculo_bia, SituacaoRelatorio.SOLICITADO)

        response = self.finalizar()

        self.assertEqual(response.status_code, 400)
        self.assertIn("bia (não enviado)", response.data["detail"])

    def test_relatorio_reprovado_impede_finalizar(self):
        self.relatorio(self.vinculo_ana, SituacaoRelatorio.APROVADO)
        self.relatorio(self.vinculo_bia, SituacaoRelatorio.REPROVADO)

        response = self.finalizar()

        self.assertEqual(response.status_code, 400)
        self.assertIn("bia (reprovado)", response.data["detail"])

    def aprovar_todos(self):
        self.relatorio(self.vinculo_ana, SituacaoRelatorio.APROVADO)
        self.relatorio(self.vinculo_bia, SituacaoRelatorio.APROVADO)

    def inscricao_de(self, nome, status):
        return Inscricao.objects.create(aluno=self.aluno(nome), bolsa=self.bolsa, status=status)

    def assert_bloqueado_por(self, trecho):
        response = self.finalizar()
        self.assertEqual(response.status_code, 400)
        self.assertIn("processos em aberto", response.data["detail"])
        self.assertIn(trecho, response.data["detail"])
        self.bolsa.refresh_from_db()
        self.assertEqual(self.bolsa.status, StatusBolsa.PREENCHIDA)

    def test_inscricao_aguardando_homologacao_impede_finalizar(self):
        self.aprovar_todos()
        self.inscricao_de("caio", StatusInscricao.PENDENTE)

        self.assert_bloqueado_por("1 inscrição aguardando homologação")

    def test_recurso_sem_julgamento_impede_finalizar(self):
        self.aprovar_todos()
        Recurso.objects.create(
            inscricao=self.inscricao_de("caio", StatusInscricao.INDEFERIDA),
            justificativa="Enviei o documento.",
            status=StatusRecurso.PENDENTE,
        )

        self.assert_bloqueado_por("1 recurso sem julgamento")

    def test_convite_em_andamento_impede_finalizar(self):
        self.aprovar_todos()
        self.convite(self.aluno("caio"), StatusConvite.ENVIADO)
        self.convite(self.aluno("davi"), StatusConvite.PENDENTE)

        self.assert_bloqueado_por("2 convites de vínculo direto em andamento")

    def test_selecao_sem_resultado_publicado_impede_finalizar(self):
        self.aprovar_todos()
        PublicacaoResultado.objects.all().delete()

        self.assert_bloqueado_por("seleção sem resultado publicado")

    def test_rascunho_e_processos_concluidos_nao_impedem_finalizar(self):
        self.aprovar_todos()
        self.inscricao_de("caio", StatusInscricao.RASCUNHO)
        self.convite(self.aluno("davi"), StatusConvite.RECUSADO)

        self.assertEqual(self.finalizar().status_code, 200)

    def test_bolsa_sem_bolsistas_nao_finaliza(self):
        VinculoBolsista.objects.all().delete()

        response = self.finalizar()

        self.assertEqual(response.status_code, 400)
        self.assertIn("não tem bolsistas", response.data["detail"])

    def test_bolsa_ja_encerrada_nao_finaliza_de_novo(self):
        self.bolsa.status = StatusBolsa.ENCERRADA
        self.bolsa.save(update_fields=["status"])

        self.assertEqual(self.finalizar().status_code, 400)

    def test_coordenador_de_outra_area_nao_finaliza(self):
        self.client.force_authenticate(self.coordenador_de_area("outra", TipoArea.PESQUISA))

        self.assertEqual(self.finalizar().status_code, 403)

    def test_coordenador_de_projeto_nao_finaliza(self):
        self.client.force_authenticate(self.coordenador)

        self.assertEqual(self.finalizar().status_code, 403)


class BolsaEncerradaTests(CenarioBolsista):
    def setUp(self):
        super().setUp()
        self.edital.data_entrega_relatorios = timezone.localdate() + timedelta(days=10)
        self.edital.save(update_fields=["data_entrega_relatorios"])
        self.vinculo_ana = self.vinculo("ana")
        self.bolsa.status = StatusBolsa.ENCERRADA
        self.bolsa.save(update_fields=["status"])

    def test_bolsa_encerrada_nao_aceita_envio_de_relatorio(self):
        self.client.force_authenticate(self.vinculo_ana.aluno)

        response = self.client.post(
            reverse("bolsistas:relatorio-final", kwargs={"pk": self.vinculo_ana.pk}),
            {"arquivo": pdf()},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("encerrada", response.data["detail"])

    def test_bolsa_encerrada_nao_aceita_parecer(self):
        self.relatorio(self.vinculo_ana)
        self.client.force_authenticate(self.coordenador)

        response = self.client.post(
            reverse("bolsistas:parecer", kwargs={"pk": self.vinculo_ana.pk}),
            {"situacao": SituacaoRelatorio.APROVADO},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("encerrada", response.data["detail"])

    def test_aluno_ve_o_motivo_na_listagem(self):
        self.client.force_authenticate(self.vinculo_ana.aluno)

        item = self.client.get(reverse("bolsistas:meus-vinculos")).data[0]

        self.assertFalse(item["pode_enviar_relatorio"])
        self.assertIn("encerrada", item["motivo_bloqueio"])


class BolsasParaFinalizarTests(CenarioBolsista):
    url = reverse("bolsistas:bolsas-para-finalizar")

    def setUp(self):
        super().setUp()
        self.coordenador_area = self.coordenador_de_area("area", TipoArea.ENSINO)
        self.vinculo_ana = self.vinculo("ana")
        self.vinculo_bia = self.vinculo("bia")
        PublicacaoResultado.objects.create(bolsa=self.bolsa, responsavel=self.coordenador)
        self.client.force_authenticate(self.coordenador_area)

    def test_mostra_andamento_dos_relatorios_e_o_motivo(self):
        self.relatorio(self.vinculo_ana, SituacaoRelatorio.APROVADO)

        item = self.client.get(self.url).data[0]

        self.assertEqual(item["total_bolsistas"], 2)
        self.assertEqual(item["relatorios_aprovados"], 1)
        self.assertFalse(item["pode_finalizar"])
        self.assertIn("bia (não solicitado)", item["motivo_bloqueio"])

    def test_libera_quando_tudo_aprovado(self):
        self.relatorio(self.vinculo_ana, SituacaoRelatorio.APROVADO)
        self.relatorio(self.vinculo_bia, SituacaoRelatorio.APROVADO)

        item = self.client.get(self.url).data[0]

        self.assertEqual(item["relatorios_aprovados"], 2)
        self.assertTrue(item["pode_finalizar"])
        self.assertEqual(item["motivo_bloqueio"], "")

    def test_bolsa_encerrada_aparece_sem_acao(self):
        self.bolsa.status = StatusBolsa.ENCERRADA
        self.bolsa.save(update_fields=["status"])

        item = self.client.get(self.url).data[0]

        self.assertEqual(item["status"], StatusBolsa.ENCERRADA)
        self.assertFalse(item["pode_finalizar"])
        self.assertEqual(item["motivo_bloqueio"], "")

    def test_bolsa_sem_bolsistas_nao_aparece(self):
        VinculoBolsista.objects.all().delete()

        self.assertEqual(self.client.get(self.url).data, [])

    def test_coordenador_de_outra_area_nao_ve(self):
        self.client.force_authenticate(self.coordenador_de_area("outra", TipoArea.PESQUISA))

        self.assertEqual(self.client.get(self.url).data, [])

    def test_coordenador_de_projeto_nao_acessa(self):
        self.client.force_authenticate(self.coordenador)

        self.assertEqual(self.client.get(self.url).status_code, 403)


class SolicitarRelatorioTests(CenarioBolsista):
    def setUp(self):
        super().setUp()
        self.edital.data_entrega_relatorios = timezone.localdate() + timedelta(days=10)
        self.edital.save(update_fields=["data_entrega_relatorios"])
        self.vinculo_ana = self.vinculo("ana")
        self.client.force_authenticate(self.coordenador)

    def solicitar(self, vinculo=None):
        vinculo = vinculo or self.vinculo_ana
        return self.client.post(reverse("bolsistas:solicitar-relatorio", kwargs={"pk": vinculo.pk}))

    def test_solicita_relatorio_ao_bolsista(self):
        response = self.solicitar()

        self.assertEqual(response.status_code, 201, response.data)
        relatorio = RelatorioFinal.objects.get(vinculo=self.vinculo_ana)
        self.assertEqual(relatorio.situacao, SituacaoRelatorio.SOLICITADO)
        self.assertEqual(relatorio.solicitado_por, self.coordenador)
        self.assertEqual(response.data["relatorio"]["situacao"], SituacaoRelatorio.SOLICITADO)
        self.assertFalse(response.data["pode_solicitar_relatorio"])

    def test_solicitacao_libera_o_envio_para_o_aluno(self):
        self.solicitar()
        self.client.force_authenticate(self.vinculo_ana.aluno)

        response = self.client.post(
            reverse("bolsistas:relatorio-final", kwargs={"pk": self.vinculo_ana.pk}),
            {"arquivo": pdf()},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200, response.data)

    def test_nao_solicita_duas_vezes(self):
        self.solicitar()

        response = self.solicitar()

        self.assertEqual(response.status_code, 400)
        self.assertIn("já foi solicitado", response.data["detail"])

    def test_nao_solicita_apos_o_prazo_do_edital(self):
        self.edital.data_entrega_relatorios = timezone.localdate() - timedelta(days=1)
        self.edital.save(update_fields=["data_entrega_relatorios"])

        response = self.solicitar()

        self.assertEqual(response.status_code, 400)
        self.assertIn("terminou", response.data["detail"])
        self.assertFalse(RelatorioFinal.objects.exists())

    def test_nao_solicita_em_bolsa_encerrada(self):
        self.bolsa.status = StatusBolsa.ENCERRADA
        self.bolsa.save(update_fields=["status"])

        response = self.solicitar()

        self.assertEqual(response.status_code, 400)
        self.assertIn("encerrada", response.data["detail"])

    def test_coordenador_de_outro_projeto_nao_solicita(self):
        outro = Usuario.objects.create_user(
            username="outro",
            email="outro@example.com",
            nome="Outro",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        CoordenadorProjeto.objects.create(usuario=outro)
        self.client.force_authenticate(outro)

        self.assertEqual(self.solicitar().status_code, 404)

    def test_aluno_nao_solicita(self):
        self.client.force_authenticate(self.vinculo_ana.aluno)

        self.assertEqual(self.solicitar().status_code, 403)
