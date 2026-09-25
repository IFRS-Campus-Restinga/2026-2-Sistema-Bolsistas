from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import CoordenadorProjeto, Usuario
from bolsas.models import Bolsa
from editais.models import Edital
from projetos.models import Projeto

from .models import (
    AnexoRecurso,
    Documento,
    Inscricao,
    NotificacaoInscricao,
    Recurso,
    StatusInscricao,
    StatusRecurso,
)


class RecursosTests(APITestCase):
    def setUp(self):
        self.media = TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        configuracao = override_settings(MEDIA_ROOT=self.media.name)
        configuracao.enable()
        self.addCleanup(configuracao.disable)
        self.aluno = Usuario.objects.create_user(
            username="aluno", email="aluno@example.com", role=Usuario.Role.ALUNO
        )
        self.coordenador = Usuario.objects.create_user(
            username="coord", email="coord@example.com", role=Usuario.Role.COORDENADOR_PROJETO
        )
        perfil = CoordenadorProjeto.objects.create(usuario=self.coordenador)
        projeto = Projeto.objects.create(titulo="Projeto", coordenador_projeto=perfil)
        hoje = timezone.localdate()
        self.edital = Edital.objects.create(
            nome="Edital",
            ano_codigo="2026-010",
            link_documento_oficial="https://example.com/edital",
            status="EM_VIGOR",
            data_recurso_homologacao_inicio=hoje - timedelta(days=1),
            data_recurso_homologacao_fim=hoje + timedelta(days=1),
        )
        self.bolsa = Bolsa.objects.create(
            projeto=projeto,
            edital=self.edital,
            tipo="ENSINO",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            status="ABERTA",
        )
        self.inscricao = Inscricao.objects.create(
            aluno=self.aluno,
            bolsa=self.bolsa,
            status="INDEFERIDA",
            data_envio=timezone.now(),
            justificativa_indeferimento="Comprovante ilegível",
            data_decisao=timezone.now(),
            responsavel_decisao=self.coordenador,
        )
        self.url = reverse("inscricoes:recursos", kwargs={"inscricao_pk": self.inscricao.pk})
        self.client.force_authenticate(self.aluno)

    def enviar(self, arquivos=0, **campos):
        dados = {"justificativa": "  Segue comprovação corrigida.  "}
        dados.update(campos)
        if arquivos:
            dados["anexos"] = [
                SimpleUploadedFile(f"documento{i}.txt", b"corrigido") for i in range(arquivos)
            ]
        return self.client.post(self.url, dados, format="multipart")

    def julgar(self, recurso, decisao="DEFERIDO", justificativa=""):
        self.client.force_authenticate(self.coordenador)
        return self.client.post(
            reverse("inscricoes:recurso-julgar", kwargs={"pk": recurso.pk}),
            {"decisao": decisao, "justificativa": justificativa},
            format="json",
        )

    def test_envio_preserva_originais_e_motivo(self):
        doc = Documento.objects.create(
            inscricao=self.inscricao,
            tipo="COMPROVANTE_MATRICULA",
            nome_original="original.txt",
            arquivo=SimpleUploadedFile("original.txt", b"original"),
        )
        resposta = self.enviar(2)
        self.assertEqual(resposta.status_code, 201)
        recurso = Recurso.objects.get()
        self.assertEqual(recurso.justificativa, "Segue comprovação corrigida.")
        self.assertEqual(recurso.motivo_contestado, "Comprovante ilegível")
        self.assertEqual(recurso.status, "PENDENTE")
        self.assertEqual(recurso.etapa, "HOMOLOGACAO")
        self.assertEqual(recurso.anexos.count(), 2)
        self.assertFalse(resposta.data["pode_enviar"])
        doc.refresh_from_db()
        with doc.arquivo.open("rb") as arquivo:
            self.assertEqual(arquivo.read(), b"original")
        self.inscricao.refresh_from_db()
        self.assertEqual(self.inscricao.status, "INDEFERIDA")

    def test_limite_cinco_anexos(self):
        self.assertEqual(self.enviar(6).status_code, 400)
        self.assertFalse(Recurso.objects.exists())
        self.assertFalse(AnexoRecurso.objects.exists())
        self.assertEqual(self.enviar(5).status_code, 201)
        self.assertEqual(AnexoRecurso.objects.count(), 5)

    def test_justificativa_obrigatoria_e_limite(self):
        for justificativa in ["", "   ", "a" * 5001]:
            with self.subTest(justificativa=justificativa):
                self.assertEqual(self.enviar(justificativa=justificativa).status_code, 400)
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 400)
        self.assertFalse(Recurso.objects.exists())

    def test_arquivo_vazio_nao_cria_recurso(self):
        response = self.client.post(
            self.url,
            {"justificativa": "Motivo", "anexos": [SimpleUploadedFile("vazio.txt", b"")]},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Recurso.objects.exists())

    def test_prazo_inclui_inicio_e_fim(self):
        hoje = timezone.localdate()
        for inicio, fim in [(hoje, hoje + timedelta(days=1)), (hoje - timedelta(days=1), hoje)]:
            self.edital.data_recurso_homologacao_inicio = inicio
            self.edital.data_recurso_homologacao_fim = fim
            self.edital.save()
            self.client.force_authenticate(self.aluno)
            self.assertEqual(self.enviar().status_code, 201)
            self.assertEqual(
                self.julgar(Recurso.objects.latest("id"), "INDEFERIDO", "Motivo").status_code, 200
            )

    def test_bloqueia_fora_do_prazo_e_datas_ausentes(self):
        hoje = timezone.localdate()
        for inicio, fim in [
            (hoje + timedelta(days=1), hoje + timedelta(days=2)),
            (hoje - timedelta(days=2), hoje - timedelta(days=1)),
            (None, hoje),
            (hoje, None),
            (hoje + timedelta(days=1), hoje - timedelta(days=1)),
        ]:
            self.edital.data_recurso_homologacao_inicio = inicio
            self.edital.data_recurso_homologacao_fim = fim
            self.edital.save()
            self.assertEqual(self.enviar().status_code, 400)
            self.assertFalse(self.client.get(self.url).data["pode_enviar"])
        self.assertFalse(Recurso.objects.exists())

    def test_um_pendente_por_inscricao_e_novo_apos_indeferimento(self):
        self.assertEqual(self.enviar().status_code, 201)
        primeiro = Recurso.objects.get()
        self.assertEqual(self.enviar().status_code, 400)
        self.assertEqual(self.julgar(primeiro, "INDEFERIDO", "Motivo").status_code, 200)
        self.client.force_authenticate(self.aluno)
        self.assertEqual(self.enviar().status_code, 201)
        self.assertEqual(Recurso.objects.count(), 2)
        primeiro.refresh_from_db()
        self.assertEqual(primeiro.status, "INDEFERIDO")

    def test_restricao_de_pendente_no_banco(self):
        Recurso.objects.create(inscricao=self.inscricao, justificativa="Primeiro")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Recurso.objects.create(inscricao=self.inscricao, justificativa="Segundo")

    def test_inscricoes_distintas_podem_ter_pendentes(self):
        self.enviar()
        bolsa = Bolsa.objects.create(
            projeto=self.bolsa.projeto,
            edital=self.edital,
            tipo="ENSINO",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            status="ABERTA",
        )
        outra = Inscricao.objects.create(
            aluno=self.aluno, bolsa=bolsa, status="INDEFERIDA", data_envio=timezone.now()
        )
        url = reverse("inscricoes:recursos", kwargs={"inscricao_pk": outra.pk})
        self.assertEqual(self.client.post(url, {"justificativa": "Motivo"}).status_code, 201)
        self.assertEqual(Recurso.objects.filter(status="PENDENTE").count(), 2)

    def test_bloqueia_inscricoes_nao_indeferidas(self):
        for estado in ["RASCUNHO", "PENDENTE", "CANCELADA", "HOMOLOGADA"]:
            self.inscricao.status = estado
            self.inscricao.save()
            self.assertEqual(self.enviar().status_code, 400)
        self.inscricao.status = "INDEFERIDA"
        self.inscricao.data_envio = None
        self.inscricao.save()
        self.assertEqual(self.enviar().status_code, 400)

    def test_bloqueia_edital_e_bolsa_inativos(self):
        self.edital.status = "ENCERRADO"
        self.edital.save()
        self.assertEqual(self.enviar().status_code, 400)
        self.edital.status = "EM_VIGOR"
        self.edital.save()
        self.bolsa.status = "CANCELADA"
        self.bolsa.save()
        self.assertEqual(self.enviar().status_code, 400)

    def test_privacidade_listagem_e_criacao(self):
        outro = Usuario.objects.create_user(
            username="outro", email="outro@example.com", role=Usuario.Role.ALUNO
        )
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.enviar().status_code, 404)
        self.client.force_authenticate(self.coordenador)
        self.assertEqual(self.client.get(self.url).status_code, 200)
        self.assertEqual(self.enviar().status_code, 403)
        outro.role = Usuario.Role.COORDENADOR_PROJETO
        outro.save()
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        for perfil in [Usuario.Role.ADMINISTRADOR, Usuario.Role.COORDENADOR_AREA]:
            outro.role = perfil
            outro.save()
            self.client.force_authenticate(outro)
            self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.assertEqual(self.enviar().status_code, 401)

    def test_deferimento_homologa_notifica_e_preserva_historico(self):
        self.enviar(1)
        recurso = Recurso.objects.get()
        self.assertEqual(self.julgar(recurso).status_code, 200)
        recurso.refresh_from_db()
        self.inscricao.refresh_from_db()
        self.assertEqual(recurso.status, StatusRecurso.DEFERIDO)
        self.assertEqual(recurso.responsavel_julgamento, self.coordenador)
        self.assertIsNotNone(recurso.julgado_em)
        self.assertEqual(recurso.motivo_contestado, "Comprovante ilegível")
        self.assertEqual(recurso.anexos.count(), 1)
        self.assertEqual(self.inscricao.status, StatusInscricao.HOMOLOGADA)
        self.assertEqual(self.inscricao.justificativa_indeferimento, "")
        self.assertEqual(self.inscricao.responsavel_decisao, self.coordenador)
        self.assertEqual(NotificacaoInscricao.objects.count(), 1)
        self.client.force_authenticate(self.aluno)
        self.assertEqual(self.enviar().status_code, 400)
        self.assertEqual(self.client.get(self.url).data["recursos"][0]["status"], "DEFERIDO")

    def test_indeferimento_exige_motivo_e_nao_altera_inscricao(self):
        self.enviar()
        recurso = Recurso.objects.get()
        data_anterior = self.inscricao.data_decisao
        self.assertEqual(self.julgar(recurso, "INDEFERIDO", "  ").status_code, 400)
        self.assertEqual(self.julgar(recurso, "INDEFERIDO", "a" * 5001).status_code, 400)
        self.assertEqual(self.julgar(recurso, "INVALIDO").status_code, 400)
        self.assertEqual(
            self.julgar(recurso, "INDEFERIDO", "  Mantido por motivo técnico.  ").status_code, 200
        )
        self.inscricao.refresh_from_db()
        self.assertEqual(self.inscricao.status, "INDEFERIDA")
        self.assertEqual(self.inscricao.data_decisao, data_anterior)
        self.assertEqual(self.inscricao.justificativa_indeferimento, "Comprovante ilegível")
        self.assertIn("Mantido por motivo técnico.", NotificacaoInscricao.objects.get().mensagem)

    def test_julgamento_apenas_responsavel_e_sem_repeticao(self):
        self.enviar()
        recurso = Recurso.objects.get()
        url = reverse("inscricoes:recurso-julgar", kwargs={"pk": recurso.pk})
        self.assertEqual(self.client.post(url, {"decisao": "DEFERIDO"}).status_code, 403)
        outro = Usuario.objects.create_user(
            username="outro", email="outro@example.com", role=Usuario.Role.COORDENADOR_PROJETO
        )
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.post(url, {"decisao": "DEFERIDO"}).status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(url, {"decisao": "DEFERIDO"}).status_code, 401)
        self.assertEqual(self.julgar(recurso).status_code, 200)
        self.assertEqual(self.julgar(recurso, "INDEFERIDO", "Motivo").status_code, 400)
        self.assertEqual(NotificacaoInscricao.objects.count(), 1)

    def test_julgamento_permitido_apos_fim_do_envio(self):
        self.enviar()
        self.edital.data_recurso_homologacao_fim = timezone.localdate() - timedelta(days=1)
        self.edital.save()
        self.assertEqual(self.julgar(Recurso.objects.get()).status_code, 200)

    def test_indeferir_recurso_nao_desfaz_homologacao_existente(self):
        self.enviar()
        self.inscricao.status = "HOMOLOGADA"
        self.inscricao.save()
        self.assertEqual(
            self.julgar(Recurso.objects.get(), "INDEFERIDO", "Motivo").status_code, 200
        )
        self.inscricao.refresh_from_db()
        self.assertEqual(self.inscricao.status, "HOMOLOGADA")

    def test_falha_notificacao_reverte_recurso_e_inscricao(self):
        self.enviar()
        recurso = Recurso.objects.get()
        with (
            patch(
                "inscricoes.recursos_views.NotificacaoInscricao.objects.create",
                side_effect=RuntimeError("falha"),
            ),
            self.assertRaises(RuntimeError),
        ):
            self.julgar(recurso)
        recurso.refresh_from_db()
        self.inscricao.refresh_from_db()
        self.assertEqual(recurso.status, "PENDENTE")
        self.assertIsNone(recurso.julgado_em)
        self.assertEqual(self.inscricao.status, "INDEFERIDA")
        self.assertFalse(NotificacaoInscricao.objects.exists())

    def test_download_privado_e_conteudo(self):
        resposta = self.enviar(1)
        anexo = AnexoRecurso.objects.get()
        url = reverse("inscricoes:recurso-anexo", kwargs={"pk": anexo.pk})
        self.assertTrue(resposta.data["recursos"][0]["anexos"][0]["arquivo"].endswith(url))
        for usuario in [self.aluno, self.coordenador]:
            self.client.force_authenticate(usuario)
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(b"".join(response.streaming_content), b"corrigido")
            response.close()
        for perfil in [Usuario.Role.ALUNO, Usuario.Role.COORDENADOR_PROJETO]:
            outro = Usuario.objects.create_user(
                username=perfil, email=f"{perfil}@example.com", role=perfil
            )
            self.client.force_authenticate(outro)
            self.assertEqual(self.client.get(url).status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 401)
        self.client.force_authenticate(self.aluno)
        anexo.arquivo.delete(save=False)
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_falha_anexo_remove_arquivo_e_reverte_recurso(self):
        with (
            patch("inscricoes.recursos_views.AnexoRecurso.save", side_effect=RuntimeError("falha")),
            self.assertRaises(RuntimeError),
        ):
            self.enviar(1)
        self.assertFalse(Recurso.objects.exists())
        self.assertFalse(AnexoRecurso.objects.exists())
        self.assertEqual([p for p in Path(self.media.name).rglob("*") if p.is_file()], [])
