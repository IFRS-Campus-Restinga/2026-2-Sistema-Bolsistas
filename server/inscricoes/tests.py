from datetime import timedelta
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import CoordenadorProjeto, Usuario
from bolsas.models import Bolsa
from editais.models import Edital
from projetos.models import Projeto

from .models import Documento, Inscricao, NotificacaoInscricao, StatusInscricao, TipoDocumento


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
            arquivo = SimpleUploadedFile("teste.txt", b"teste")
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
