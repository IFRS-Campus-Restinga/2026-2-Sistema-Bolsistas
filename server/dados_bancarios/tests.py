from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Aluno, CoordenadorProjeto, Usuario
from bolsas.models import Bolsa
from editais.models import Edital
from inscricoes.models import Inscricao, StatusInscricao
from projetos.models import Projeto

from .models import DadosBancarios


class MeusDadosBancariosTests(APITestCase):
    def setUp(self):
        self.temp_dir = TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)

        self.media_override = override_settings(MEDIA_ROOT=self.temp_dir.name)
        self.media_override.enable()
        self.addCleanup(self.media_override.disable)

        self.usuario = Usuario.objects.create_user(
            username="aluno",
            email="aluno@example.com",
            nome="Aluno Teste",
            role=Usuario.Role.ALUNO,
        )
        self.aluno = Aluno.objects.create(usuario=self.usuario)
        self.url = reverse("dados_bancarios:meus")
        self.client.force_authenticate(self.usuario)

    def dados_validos(self, **alteracoes):
        dados = {
            "banco": "Banco do Brasil",
            "agencia": "1234-5",
            "conta": "67890-1",
        }
        dados.update(alteracoes)
        return dados

    def test_consulta_sem_cadastro_retorna_campos_vazios(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["id"])
        self.assertEqual(response.data["banco"], "")
        self.assertFalse(response.data["cadastro_completo"])

    def test_aluno_cadastra_dados_bancarios(self):
        response = self.client.put(
            self.url,
            self.dados_validos(),
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(DadosBancarios.objects.count(), 1)

        dados = DadosBancarios.objects.get()
        self.assertEqual(dados.aluno, self.aluno)
        self.assertEqual(dados.banco, "Banco do Brasil")
        self.assertTrue(response.data["cadastro_completo"])

    def test_edicao_atualiza_o_mesmo_cadastro(self):
        self.client.put(
            self.url,
            self.dados_validos(),
            format="json",
        )

        response = self.client.put(
            self.url,
            self.dados_validos(banco="Caixa Econômica"),
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(DadosBancarios.objects.count(), 1)
        self.assertEqual(
            DadosBancarios.objects.get().banco,
            "Caixa Econômica",
        )

    def test_campos_bancarios_sao_obrigatorios(self):
        for campo in ["banco", "agencia", "conta"]:
            with self.subTest(campo=campo):
                dados = self.dados_validos()
                dados[campo] = ""

                response = self.client.put(
                    self.url,
                    dados,
                    format="json",
                )

                self.assertEqual(response.status_code, 400)
                self.assertIn(campo, response.data)

        self.assertFalse(DadosBancarios.objects.exists())

    def test_comprovante_valido_pode_ser_baixado(self):
        comprovante = SimpleUploadedFile(
            "comprovante.pdf",
            b"conteudo do comprovante",
            content_type="application/pdf",
        )

        response = self.client.put(
            self.url,
            self.dados_validos(comprovante=comprovante),
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertNotIn("comprovante", response.data)
        self.assertIsNotNone(response.data["comprovante_url"])

        dados = DadosBancarios.objects.get()
        download = self.client.get(
            reverse(
                "dados_bancarios:comprovante",
                kwargs={"pk": dados.pk},
            )
        )

        self.assertEqual(download.status_code, 200)
        self.assertEqual(
            b"".join(download.streaming_content),
            b"conteudo do comprovante",
        )

    def test_rejeita_formato_de_comprovante_nao_permitido(self):
        comprovante = SimpleUploadedFile(
            "programa.exe",
            b"arquivo invalido",
            content_type="application/octet-stream",
        )

        response = self.client.put(
            self.url,
            self.dados_validos(comprovante=comprovante),
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("comprovante", response.data)
        self.assertFalse(DadosBancarios.objects.exists())

    def test_novo_comprovante_remove_o_arquivo_anterior(self):
        primeiro = SimpleUploadedFile(
            "primeiro.pdf",
            b"primeiro",
            content_type="application/pdf",
        )
        self.client.put(
            self.url,
            self.dados_validos(comprovante=primeiro),
            format="multipart",
        )

        dados = DadosBancarios.objects.get()
        caminho_anterior = Path(dados.comprovante.path)
        self.assertTrue(caminho_anterior.exists())

        segundo = SimpleUploadedFile(
            "segundo.pdf",
            b"segundo",
            content_type="application/pdf",
        )
        response = self.client.put(
            self.url,
            self.dados_validos(comprovante=segundo),
            format="multipart",
        )

        dados.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertFalse(caminho_anterior.exists())
        self.assertEqual(Path(dados.comprovante.path).read_bytes(), b"segundo")


class ConsultaDadosBancariosTests(APITestCase):
    def setUp(self):
        self.aluno_usuario = Usuario.objects.create_user(
            username="aluno_consulta",
            email="aluno_consulta@example.com",
            nome="Aluno Protegido",
            role=Usuario.Role.ALUNO,
        )
        self.aluno = Aluno.objects.create(usuario=self.aluno_usuario)
        self.dados = DadosBancarios.objects.create(
            aluno=self.aluno,
            banco="Banco Teste",
            agencia="1234-5",
            conta="67890-1",
        )

        self.coordenador = Usuario.objects.create_user(
            username="coordenador",
            email="coordenador@example.com",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        perfil_coordenador = CoordenadorProjeto.objects.create(
            usuario=self.coordenador,
        )

        projeto = Projeto.objects.create(
            titulo="Projeto do coordenador",
            coordenador_projeto=perfil_coordenador,
        )
        edital = Edital.objects.create(
            nome="Edital de teste",
            ano_codigo="2026-051",
            link_documento_oficial="https://example.com/edital",
        )
        bolsa = Bolsa.objects.create(
            projeto=projeto,
            edital=edital,
            tipo="ENSINO",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
        )
        Inscricao.objects.create(
            aluno=self.aluno_usuario,
            bolsa=bolsa,
            status=StatusInscricao.PENDENTE,
            data_envio=timezone.now(),
        )

        self.url = reverse(
            "dados_bancarios:aluno",
            kwargs={"aluno_id": self.aluno_usuario.id},
        )

    def test_coordenador_vinculado_acessa_dados_do_aluno(self):
        self.client.force_authenticate(self.coordenador)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["aluno_nome"], "Aluno Protegido")
        self.assertEqual(response.data["banco"], "Banco Teste")

    def test_outro_coordenador_nao_acessa_dados_do_aluno(self):
        outro = Usuario.objects.create_user(
            username="outro_coordenador",
            email="outro_coordenador@example.com",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        CoordenadorProjeto.objects.create(usuario=outro)
        self.client.force_authenticate(outro)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 404)

    def test_administrador_acessa_dados_do_aluno(self):
        administrador = Usuario.objects.create_user(
            username="administrador",
            email="administrador@example.com",
            role=Usuario.Role.ADMINISTRADOR,
        )
        self.client.force_authenticate(administrador)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["conta"], "67890-1")

    def test_aluno_nao_acessa_endpoint_administrativo(self):
        self.client.force_authenticate(self.aluno_usuario)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)

    def test_visitante_nao_acessa_dados_bancarios(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 401)

    def test_coordenador_nao_altera_dados_pelo_endpoint_do_aluno(self):
        self.client.force_authenticate(self.coordenador)

        response = self.client.put(
            reverse("dados_bancarios:meus"),
            {
                "banco": "Banco alterado",
                "agencia": "0000",
                "conta": "0000",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.dados.refresh_from_db()
        self.assertEqual(self.dados.banco, "Banco Teste")
