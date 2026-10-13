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
    TipoDocumento,
)


class CandidatoListTests(APITestCase):
    def setUp(self):
        self.coordenador = self.usuario("coordenador", Usuario.Role.COORDENADOR_PROJETO)
        perfil = CoordenadorProjeto.objects.create(usuario=self.coordenador)
        projeto = Projeto.objects.create(titulo="Projeto teste", coordenador_projeto=perfil)
        edital = Edital.objects.create(
            nome="Edital teste",
            ano_codigo="2026-001",
            link_documento_oficial="https://example.com/edital",
        )
        self.bolsa = Bolsa.objects.create(
            projeto=projeto,
            edital=edital,
            tipo="PESQUISA",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
        )
        self.url = reverse("inscricoes:candidatos", kwargs={"bolsa_pk": self.bolsa.pk})
        self.client.force_authenticate(self.coordenador)

    def usuario(self, nome, role=Usuario.Role.ALUNO):
        return Usuario.objects.create_user(
            username=nome,
            email=f"{nome}@example.com",
            role=role,
        )

    def inscricao(self, nome, **kwargs):
        dados = {
            "bolsa": self.bolsa,
            "status": StatusInscricao.PENDENTE,
            "data_envio": timezone.now(),
        }
        dados.update(kwargs)
        return Inscricao.objects.create(aluno=self.usuario(nome), **dados)

    def test_lista_apenas_enviadas_da_bolsa_solicitada(self):
        enviada = self.inscricao("enviada")
        enviada.aluno.nome = "Nome do aluno"
        enviada.aluno.save()
        self.inscricao("rascunho", status=StatusInscricao.RASCUNHO, data_envio=None)
        self.inscricao("cancelada", status=StatusInscricao.CANCELADA)
        self.inscricao("sem_envio", data_envio=None)
        outra_bolsa = Bolsa.objects.create(
            projeto=self.bolsa.projeto,
            edital=self.bolsa.edital,
            tipo="PESQUISA",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
        )
        self.inscricao("outra_bolsa", bolsa=outra_bolsa)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [enviada.pk])
        self.assertEqual(response.data[0]["aluno_nome"], "Nome do aluno")
        self.assertFalse(response.data[0]["documentacao_completa"])

    def test_documentacao_exige_os_dois_tipos_obrigatorios(self):
        inscricao = self.inscricao("documentos")
        for tipo in [TipoDocumento.HISTORICO_ESCOLAR, TipoDocumento.ADICIONAL]:
            Documento.objects.create(inscricao=inscricao, tipo=tipo, arquivo="teste.pdf")
        response = self.client.get(self.url)
        self.assertFalse(response.data[0]["documentacao_completa"])
        Documento.objects.create(
            inscricao=inscricao,
            tipo=TipoDocumento.COMPROVANTE_MATRICULA,
            arquivo="teste.pdf",
        )
        response = self.client.get(self.url)
        self.assertTrue(response.data[0]["documentacao_completa"])

    def test_outro_coordenador_nao_acessa_bolsa(self):
        outro = self.usuario("outro", Usuario.Role.COORDENADOR_PROJETO)
        CoordenadorProjeto.objects.create(usuario=outro)
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_outros_perfis_nao_acessam(self):
        for role in [Usuario.Role.ALUNO, Usuario.Role.ADMINISTRADOR, Usuario.Role.COORDENADOR_AREA]:
            with self.subTest(role=role):
                self.client.force_authenticate(self.usuario(role, role))
                self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_visitante_nao_acessa(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_bolsa_inexistente_retorna_404(self):
        url = reverse("inscricoes:candidatos", kwargs={"bolsa_pk": self.bolsa.pk + 100})
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_bolsa_sem_candidatos_retorna_lista_vazia(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])


class HomologacaoTests(APITestCase):
    def setUp(self):
        self.coordenador = Usuario.objects.create_user(
            username="coord", email="coord@example.com", role=Usuario.Role.COORDENADOR_PROJETO
        )
        perfil = CoordenadorProjeto.objects.create(usuario=self.coordenador)
        projeto = Projeto.objects.create(titulo="Projeto teste", coordenador_projeto=perfil)
        self.edital = Edital.objects.create(
            nome="Edital teste",
            ano_codigo="2026-002",
            link_documento_oficial="https://example.com/edital",
            status=Edital.Status.EM_VIGOR,
            data_fechamento_inscricoes=timezone.localdate() - timedelta(days=1),
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
        self.aluno = Usuario.objects.create_user(
            username="aluno", email="aluno@example.com", role=Usuario.Role.ALUNO
        )
        self.inscricao = Inscricao.objects.create(
            aluno=self.aluno,
            bolsa=self.bolsa,
            status=StatusInscricao.PENDENTE,
            data_envio=timezone.now(),
            termos_aceitos=True,
        )
        for tipo in [TipoDocumento.HISTORICO_ESCOLAR, TipoDocumento.COMPROVANTE_MATRICULA]:
            Documento.objects.create(inscricao=self.inscricao, tipo=tipo, arquivo="teste.pdf")
        self.client.force_authenticate(self.coordenador)

    def url(self, acao):
        return reverse(f"inscricoes:{acao}", kwargs={"pk": self.inscricao.pk})

    def test_homologa_registra_responsavel_e_notifica(self):
        response = self.client.post(self.url("homologar"))
        self.assertEqual(response.status_code, 200)
        self.inscricao.refresh_from_db()
        self.assertEqual(self.inscricao.status, StatusInscricao.HOMOLOGADA)
        self.assertEqual(self.inscricao.responsavel_decisao, self.coordenador)
        self.assertIsNotNone(self.inscricao.data_decisao)
        self.assertEqual(self.inscricao.justificativa_indeferimento, "")
        self.assertEqual(NotificacaoInscricao.objects.count(), 1)
        self.assertIn("homologada", NotificacaoInscricao.objects.get().mensagem)

    def test_indefere_com_motivo_visivel_somente_ao_aluno(self):
        response = self.client.post(
            self.url("indeferir"), {"justificativa": "  Documento ilegível.  "}
        )
        self.assertEqual(response.status_code, 200)
        self.inscricao.refresh_from_db()
        self.assertEqual(self.inscricao.status, StatusInscricao.INDEFERIDA)
        self.assertEqual(self.inscricao.justificativa_indeferimento, "Documento ilegível.")
        self.assertIn("Documento ilegível.", NotificacaoInscricao.objects.get().mensagem)
        self.client.force_authenticate(self.aluno)
        response = self.client.get(self.url("detalhe"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["justificativa_indeferimento"], "Documento ilegível.")
        self.assertEqual(len(response.data["notificacoes"]), 1)
        outro = Usuario.objects.create_user(
            username="outro", email="outro@example.com", role=Usuario.Role.ALUNO
        )
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.get(self.url("detalhe")).status_code, 404)
        self.assertEqual(self.client.get(reverse("inscricoes:lista-criacao")).data, [])

    def test_justificativa_obrigatoria(self):
        for payload in [
            {},
            {"justificativa": "   "},
            {"justificativa": None},
            {"justificativa": "a" * 5001},
        ]:
            with self.subTest(payload=payload):
                self.assertEqual(
                    self.client.post(self.url("indeferir"), payload, format="json").status_code, 400
                )
        self.inscricao.refresh_from_db()
        self.assertEqual(self.inscricao.status, StatusInscricao.PENDENTE)
        self.assertFalse(NotificacaoInscricao.objects.exists())

    def test_bloqueia_decisoes_em_estados_invalidos(self):
        for estado in [
            StatusInscricao.RASCUNHO,
            StatusInscricao.CANCELADA,
            StatusInscricao.HOMOLOGADA,
            StatusInscricao.INDEFERIDA,
        ]:
            self.inscricao.status = estado
            self.inscricao.save()
            for acao in ["homologar", "indeferir"]:
                with self.subTest(estado=estado, acao=acao):
                    self.assertEqual(
                        self.client.post(self.url(acao), {"justificativa": "Motivo"}).status_code,
                        400,
                    )
        self.assertFalse(NotificacaoInscricao.objects.exists())

    def test_repeticao_nao_duplica_notificacao(self):
        self.assertEqual(self.client.post(self.url("homologar")).status_code, 200)
        self.assertEqual(self.client.post(self.url("homologar")).status_code, 400)
        self.assertEqual(
            self.client.post(self.url("indeferir"), {"justificativa": "Outra decisão"}).status_code,
            400,
        )
        self.assertEqual(NotificacaoInscricao.objects.count(), 1)

    def test_outro_coordenador_nao_consulta_nem_decide(self):
        outro = Usuario.objects.create_user(
            username="outro", email="outro@example.com", role=Usuario.Role.COORDENADOR_PROJETO
        )
        CoordenadorProjeto.objects.create(usuario=outro)
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.get(self.url("candidato-detalhe")).status_code, 404)
        for acao in ["homologar", "indeferir"]:
            self.assertEqual(
                self.client.post(self.url(acao), {"justificativa": "Motivo"}).status_code, 404
            )

    def test_perfis_sem_permissao_e_visitante(self):
        for role in [Usuario.Role.ALUNO, Usuario.Role.ADMINISTRADOR, Usuario.Role.COORDENADOR_AREA]:
            usuario = Usuario.objects.create_user(
                username=role, email=f"{role}@example.com", role=role
            )
            self.client.force_authenticate(usuario)
            self.assertEqual(self.client.get(self.url("candidato-detalhe")).status_code, 403)
            for acao in ["homologar", "indeferir"]:
                self.assertEqual(
                    self.client.post(self.url(acao), {"justificativa": "Motivo"}).status_code, 403
                )
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(self.url("homologar")).status_code, 401)
        self.assertEqual(self.client.post(self.url("indeferir")).status_code, 401)

    def test_nao_homologa_sem_documentos_obrigatorios(self):
        Documento.objects.filter(
            inscricao=self.inscricao, tipo=TipoDocumento.HISTORICO_ESCOLAR
        ).update(tipo=TipoDocumento.ADICIONAL)
        self.assertEqual(self.client.post(self.url("homologar")).status_code, 400)
        self.assertFalse(NotificacaoInscricao.objects.exists())

    def test_nao_decide_inscricao_sem_envio(self):
        self.inscricao.data_envio = None
        self.inscricao.save()
        self.assertEqual(self.client.post(self.url("homologar")).status_code, 400)

    def test_bloqueia_bolsa_encerrada_e_edital_inativo(self):
        self.bolsa.status = "ENCERRADA"
        self.bolsa.save()
        self.assertEqual(self.client.post(self.url("homologar")).status_code, 400)
        self.bolsa.status = "ABERTA"
        self.bolsa.save()
        self.edital.status = Edital.Status.ENCERRADO
        self.edital.save()
        self.assertEqual(
            self.client.post(self.url("indeferir"), {"justificativa": "Motivo"}).status_code, 400
        )

    def test_falha_na_notificacao_reverte_decisao(self):
        with patch(
            "inscricoes.views.NotificacaoInscricao.objects.create",
            side_effect=RuntimeError("falha"),
        ):
            with self.assertRaises(RuntimeError):
                self.client.post(self.url("homologar"))
        self.inscricao.refresh_from_db()
        self.assertEqual(self.inscricao.status, StatusInscricao.PENDENTE)
        self.assertIsNone(self.inscricao.data_decisao)
        self.assertFalse(NotificacaoInscricao.objects.exists())

    def test_aluno_nao_edita_inscricao_ou_documentos_apos_decisao(self):
        for acao in ["homologar", "indeferir"]:
            self.edital.data_fechamento_inscricoes = timezone.localdate() - timedelta(days=1)
            self.edital.save()
            self.inscricao.status = StatusInscricao.PENDENTE
            self.inscricao.save()
            self.client.force_authenticate(self.coordenador)
            self.assertEqual(
                self.client.post(self.url(acao), {"justificativa": "Motivo"}).status_code, 200
            )
            self.edital.data_fechamento_inscricoes = timezone.localdate() + timedelta(days=1)
            self.edital.save()
            self.client.force_authenticate(self.aluno)
            self.assertEqual(
                self.client.patch(
                    self.url("detalhe"), {"link_lattes": "https://example.com/novo"}
                ).status_code,
                400,
            )
            documento = self.inscricao.documentos.first()
            self.assertEqual(
                self.client.delete(
                    reverse("inscricoes:documento-detalhe", kwargs={"pk": documento.pk})
                ).status_code,
                400,
            )
            arquivo = SimpleUploadedFile("teste.pdf", b"teste")
            response = self.client.post(
                reverse("inscricoes:documentos", kwargs={"inscricao_pk": self.inscricao.pk}),
                {"tipo": "ADICIONAL", "arquivo": arquivo},
                format="multipart",
            )
            self.assertEqual(response.status_code, 400)

    def test_notificacao_so_pode_ser_lida_pelo_destinatario(self):
        self.client.post(self.url("homologar"))
        notificacao = NotificacaoInscricao.objects.get()
        url = reverse("inscricoes:notificacao-ler", kwargs={"pk": notificacao.pk})
        outro = Usuario.objects.create_user(
            username="outro", email="outro@example.com", role=Usuario.Role.ALUNO
        )
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.post(url).status_code, 404)
        self.client.force_authenticate(self.aluno)
        self.assertEqual(self.client.post(url).status_code, 200)
        notificacao.refresh_from_db()
        primeira_leitura = notificacao.lida_em
        self.assertIsNotNone(primeira_leitura)
        self.assertEqual(self.client.post(url).status_code, 200)
        notificacao.refresh_from_db()
        self.assertEqual(notificacao.lida_em, primeira_leitura)

    def test_download_autorizado_e_conteudo_do_arquivo(self):
        with TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            documento = Documento.objects.create(
                inscricao=self.inscricao,
                tipo="ADICIONAL",
                nome_original="anexo.txt",
                arquivo=SimpleUploadedFile("anexo.txt", b"conteudo de teste"),
            )
            try:
                url = reverse("inscricoes:documento-arquivo", kwargs={"pk": documento.pk})
                detalhe = self.client.get(self.url("candidato-detalhe"))
                self.assertEqual(detalhe.status_code, 200)
                self.assertTrue(
                    any(doc["arquivo"].endswith(url) for doc in detalhe.data["documentos"])
                )
                for usuario in [self.coordenador, self.aluno]:
                    self.client.force_authenticate(usuario)
                    resposta = self.client.get(url)
                    self.assertEqual(resposta.status_code, 200)
                    self.assertEqual(b"".join(resposta.streaming_content), b"conteudo de teste")
                    resposta.close()
                for role in [Usuario.Role.ALUNO, Usuario.Role.COORDENADOR_PROJETO]:
                    outro = Usuario.objects.create_user(
                        username=role, email=f"{role}@example.com", role=role
                    )
                    self.client.force_authenticate(outro)
                    self.assertEqual(self.client.get(url).status_code, 404)
                self.client.force_authenticate(None)
                self.assertEqual(self.client.get(url).status_code, 401)
                self.client.force_authenticate(self.coordenador)
                self.inscricao.status = StatusInscricao.RASCUNHO
                self.inscricao.save()
                self.assertEqual(self.client.get(url).status_code, 404)
            finally:
                documento.arquivo.delete(save=False)

    def test_documento_ausente_retorna_404(self):
        with TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            documento = self.inscricao.documentos.first()
            response = self.client.get(
                reverse("inscricoes:documento-arquivo", kwargs={"pk": documento.pk})
            )
            self.assertEqual(response.status_code, 404)

    def test_decisao_so_apos_o_dia_de_fechamento(self):
        for fechamento in [None, timezone.localdate(), timezone.localdate() + timedelta(days=1)]:
            self.edital.data_fechamento_inscricoes = fechamento
            self.edital.save()
            for acao in ["homologar", "indeferir"]:
                with self.subTest(fechamento=fechamento, acao=acao):
                    self.assertEqual(
                        self.client.post(self.url(acao), {"justificativa": "Motivo"}).status_code,
                        400,
                    )
        self.assertFalse(NotificacaoInscricao.objects.exists())
        self.inscricao.refresh_from_db()
        self.assertEqual(self.inscricao.status, StatusInscricao.PENDENTE)


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
                SimpleUploadedFile(f"documento{i}.pdf", b"corrigido") for i in range(arquivos)
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
            {"justificativa": "Motivo", "anexos": [SimpleUploadedFile("vazio.pdf", b"")]},
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
                "inscricoes.views.NotificacaoInscricao.objects.create",
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
            patch("inscricoes.views.AnexoRecurso.save", side_effect=RuntimeError("falha")),
            self.assertRaises(RuntimeError),
        ):
            self.enviar(1)
        self.assertFalse(Recurso.objects.exists())
        self.assertFalse(AnexoRecurso.objects.exists())
        self.assertEqual([p for p in Path(self.media.name).rglob("*") if p.is_file()], [])

    def test_expirado_apos_ultimo_dia_mantem_julgamento(self):
        self.enviar()
        recurso = Recurso.objects.get()
        self.edital.data_recurso_homologacao_fim = timezone.localdate()
        self.edital.save()
        self.assertEqual(self.client.get(self.url).data["recursos"][0]["status"], "PENDENTE")
        self.edital.data_recurso_homologacao_fim -= timedelta(days=1)
        self.edital.save()
        dados = self.client.get(self.url).data
        self.assertEqual(dados["recursos"][0]["status"], "EXPIRADO")
        self.assertFalse(dados["pode_enviar"])
        self.assertEqual(dados["motivo_bloqueio"], "O período de interpor recursos encerrou.")
        self.assertEqual(self.enviar().status_code, 400)
        self.assertEqual(self.julgar(recurso).status_code, 200)
        self.inscricao.refresh_from_db()
        self.assertEqual(self.inscricao.status, "HOMOLOGADA")
        self.assertEqual(self.client.get(self.url).data["recursos"][0]["status"], "DEFERIDO")

    def test_historico_privado_e_disponivel_fora_do_prazo(self):
        self.enviar()
        self.edital.data_recurso_homologacao_fim = timezone.localdate() - timedelta(days=1)
        self.edital.save()
        url = reverse("inscricoes:recursos-lista")
        resposta = self.client.get(url)
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.data[0]["status"], "EXPIRADO")
        self.assertEqual(resposta.data[0]["projeto_titulo"], "Projeto")
        outro = Usuario.objects.create_user(username="outro", role=Usuario.Role.ALUNO)
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.get(url).data, [])
        self.client.force_authenticate(self.coordenador)
        self.assertEqual(len(self.client.get(url).data), 1)
        outro_coord = Usuario.objects.create_user(
            username="outrocoord",
            email="outrocoord@example.com",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        CoordenadorProjeto.objects.create(usuario=outro_coord)
        self.client.force_authenticate(outro_coord)
        self.assertEqual(self.client.get(url).data, [])
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 401)

    def test_bolsa_da_inscricao_acessivel_apos_prazo_apenas_ao_dono(self):
        self.edital.data_fechamento_inscricoes = timezone.localdate() - timedelta(days=2)
        self.edital.save()
        url = reverse("inscricoes:inscricao-bolsa", kwargs={"pk": self.inscricao.pk})
        resposta = self.client.get(url)
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.data["id"], self.bolsa.pk)
        outro = Usuario.objects.create_user(username="outro", role=Usuario.Role.ALUNO)
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 401)

    def test_mensagens_sem_ids_preservam_justificativa(self):
        from .serializers import NotificacaoInscricaoSerializer

        antiga = NotificacaoInscricao.objects.create(
            inscricao=self.inscricao,
            mensagem="Seu recurso #2 de homologação, na bolsa #6, foi indeferido. Justificativa: Rever item #7.",
        )
        texto = NotificacaoInscricaoSerializer(antiga).data["mensagem"]
        self.assertNotIn("#2", texto)
        self.assertNotIn("#6", texto)
        self.assertIn('projeto "Projeto"', texto)
        self.assertIn("item #7", texto)
        self.enviar()
        self.julgar(Recurso.objects.get())
        texto = NotificacaoInscricao.objects.order_by("-id").first().mensagem
        self.assertNotIn("#", texto)


class UploadDocumentoTests(APITestCase):
    """Cobre a validação de tipo/tamanho dos arquivos enviados pelo aluno."""

    def setUp(self):
        self.media = TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        configuracao = override_settings(MEDIA_ROOT=self.media.name)
        configuracao.enable()
        self.addCleanup(configuracao.disable)

        self.aluno = Usuario.objects.create_user(
            username="aluno", email="aluno@example.com", role=Usuario.Role.ALUNO
        )
        coordenador = Usuario.objects.create_user(
            username="coord", email="coord@example.com", role=Usuario.Role.COORDENADOR_PROJETO
        )
        perfil = CoordenadorProjeto.objects.create(usuario=coordenador)
        projeto = Projeto.objects.create(titulo="Projeto", coordenador_projeto=perfil)
        hoje = timezone.localdate()
        edital = Edital.objects.create(
            nome="Edital",
            ano_codigo="2026-020",
            link_documento_oficial="https://example.com/edital",
            status="EM_VIGOR",
            data_abertura_inscricoes=hoje - timedelta(days=1),
            data_fechamento_inscricoes=hoje + timedelta(days=1),
        )
        bolsa = Bolsa.objects.create(
            projeto=projeto,
            edital=edital,
            tipo="ENSINO",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            status="ABERTA",
        )
        self.inscricao = Inscricao.objects.create(aluno=self.aluno, bolsa=bolsa)
        self.url = reverse("inscricoes:documentos", kwargs={"inscricao_pk": self.inscricao.pk})
        self.client.force_authenticate(self.aluno)

    def enviar(self, arquivo, tipo="ADICIONAL"):
        return self.client.post(self.url, {"tipo": tipo, "arquivo": arquivo}, format="multipart")

    def test_aceita_pdf_e_imagem(self):
        for nome in ["historico.pdf", "foto.jpg", "foto.jpeg", "print.PNG"]:
            with self.subTest(nome=nome):
                resposta = self.enviar(SimpleUploadedFile(nome, b"conteudo"))
                self.assertEqual(resposta.status_code, 201, resposta.data)

    def test_recusa_extensao_nao_permitida(self):
        for nome in ["documento.txt", "planilha.xlsx", "script.exe", "sem_extensao"]:
            with self.subTest(nome=nome):
                resposta = self.enviar(SimpleUploadedFile(nome, b"conteudo"))
                self.assertEqual(resposta.status_code, 400)
        self.assertFalse(Documento.objects.exists())

    def test_recusa_arquivo_acima_do_limite(self):
        grande = SimpleUploadedFile("historico.pdf", b"x" * (10 * 1024 * 1024 + 1))
        resposta = self.enviar(grande)
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("10 MB", str(resposta.data))
        self.assertFalse(Documento.objects.exists())


class PrazoSemDataDefinidaTests(APITestCase):
    """Edital sem data de fechamento não deve derrubar os endpoints (antes dava 500)."""

    def setUp(self):
        self.aluno = Usuario.objects.create_user(
            username="aluno", email="aluno@example.com", role=Usuario.Role.ALUNO
        )
        coordenador = Usuario.objects.create_user(
            username="coord", email="coord@example.com", role=Usuario.Role.COORDENADOR_PROJETO
        )
        perfil = CoordenadorProjeto.objects.create(usuario=coordenador)
        projeto = Projeto.objects.create(titulo="Projeto", coordenador_projeto=perfil)
        self.edital = Edital.objects.create(
            nome="Edital sem cronograma",
            ano_codigo="2026-021",
            link_documento_oficial="https://example.com/edital",
            status="EM_VIGOR",
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
        self.client.force_authenticate(self.aluno)

    def test_listagem_nao_quebra_e_prazo_nao_esta_encerrado(self):
        Inscricao.objects.create(aluno=self.aluno, bolsa=self.bolsa)
        resposta = self.client.get(reverse("inscricoes:lista-criacao"))
        self.assertEqual(resposta.status_code, 200)
        self.assertFalse(resposta.data[0]["prazo_inscricao_encerrado"])

    def test_edicao_de_rascunho_nao_quebra(self):
        inscricao = Inscricao.objects.create(aluno=self.aluno, bolsa=self.bolsa)
        resposta = self.client.patch(
            reverse("inscricoes:detalhe", kwargs={"pk": inscricao.pk}),
            {"link_lattes": "https://lattes.cnpq.br/123"},
            format="json",
        )
        self.assertEqual(resposta.status_code, 200)

    def test_cancelamento_nao_quebra(self):
        inscricao = Inscricao.objects.create(
            aluno=self.aluno,
            bolsa=self.bolsa,
            status=StatusInscricao.PENDENTE,
            data_envio=timezone.now(),
        )
        resposta = self.client.post(reverse("inscricoes:cancelar", kwargs={"pk": inscricao.pk}))
        self.assertEqual(resposta.status_code, 200)
        inscricao.refresh_from_db()
        self.assertEqual(inscricao.status, StatusInscricao.CANCELADA)

    def test_criacao_bloqueada_sem_janela_definida(self):
        resposta = self.client.post(
            reverse("inscricoes:lista-criacao"), {"bolsa": self.bolsa.pk}, format="json"
        )
        self.assertEqual(resposta.status_code, 400)
