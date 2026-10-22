from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import CoordenadorArea, CoordenadorProjeto, Usuario
from auditoria.models import AcaoAuditoria, EntidadeAuditoria, LogAuditoria
from bolsas.models import Bolsa, StatusBolsa
from editais.models import Edital
from inscricoes.models import Inscricao, StatusInscricao, TipoDocumento
from projetos.models import Projeto

from .models import ConviteVinculoDireto, NotificacaoConvite, StatusConvite
from .regras import bolsa_elegivel_para_convite, vagas_livres


def _edital(**kwargs):
    base = {
        "nome": "Edital teste",
        "ano_codigo": "2026-003",
        "link_documento_oficial": "https://example.com/edital",
        "status": Edital.Status.EM_VIGOR,
        "data_fechamento_inscricoes": timezone.localdate() - timedelta(days=30),
        "data_recurso_homologacao_fim": timezone.localdate() - timedelta(days=1),
    }
    base.update(kwargs)
    return Edital.objects.create(**base)


class VinculoDiretoTestBase(APITestCase):
    def setUp(self):
        self.coordenador = Usuario.objects.create_user(
            username="coord", email="coord@example.com", role=Usuario.Role.COORDENADOR_PROJETO
        )
        perfil_projeto = CoordenadorProjeto.objects.create(usuario=self.coordenador)
        self.projeto = Projeto.objects.create(
            titulo="Projeto teste", coordenador_projeto=perfil_projeto
        )

        self.coordenador_area = Usuario.objects.create_user(
            username="coord_area",
            email="coord_area@example.com",
            role=Usuario.Role.COORDENADOR_AREA,
        )
        self.perfil_area = CoordenadorArea.objects.create(
            usuario=self.coordenador_area, tipo_area="ENSINO"
        )

        self.edital = _edital()
        self.bolsa = Bolsa.objects.create(
            projeto=self.projeto,
            edital=self.edital,
            tipo="ENSINO",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            status=StatusBolsa.ABERTA,
            coordenador_area=self.perfil_area,
        )
        self.aluno = Usuario.objects.create_user(
            username="aluno", email="aluno@example.com", role=Usuario.Role.ALUNO
        )


class RegrasElegibilidadeTests(VinculoDiretoTestBase):
    def test_bolsa_sem_ocupantes_e_recurso_encerrado_e_elegivel(self):
        self.assertEqual(vagas_livres(self.bolsa), 1)
        self.assertTrue(bolsa_elegivel_para_convite(self.bolsa))

    def test_bolsa_com_inscricao_homologada_nao_e_elegivel(self):
        Inscricao.objects.create(
            aluno=self.aluno, bolsa=self.bolsa, status=StatusInscricao.HOMOLOGADA
        )
        self.assertEqual(vagas_livres(self.bolsa), 0)
        self.assertFalse(bolsa_elegivel_para_convite(self.bolsa))

    def test_bolsa_com_recurso_ainda_aberto_nao_e_elegivel(self):
        self.edital.data_recurso_homologacao_fim = timezone.localdate() + timedelta(days=5)
        self.edital.save()
        self.assertFalse(bolsa_elegivel_para_convite(self.bolsa))

    def test_convite_ativo_ocupa_vaga(self):
        ConviteVinculoDireto.objects.create(
            bolsa=self.bolsa,
            aluno=self.aluno,
            coordenador_solicitante=self.coordenador,
            status=StatusConvite.PENDENTE,
        )
        self.assertEqual(vagas_livres(self.bolsa), 0)
        self.assertFalse(bolsa_elegivel_para_convite(self.bolsa))

    def test_convite_recusado_nao_ocupa_vaga(self):
        ConviteVinculoDireto.objects.create(
            bolsa=self.bolsa,
            aluno=self.aluno,
            coordenador_solicitante=self.coordenador,
            status=StatusConvite.RECUSADO,
        )
        self.assertEqual(vagas_livres(self.bolsa), 1)
        self.assertTrue(bolsa_elegivel_para_convite(self.bolsa))


class CriarConviteTests(VinculoDiretoTestBase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.coordenador)

    def _payload(self):
        return {"bolsa": self.bolsa.id, "aluno": self.aluno.id}

    def test_cria_convite_com_sucesso(self):
        response = self.client.post(reverse("vinculo_direto:convites"), self._payload())
        self.assertEqual(response.status_code, 201)
        convite = ConviteVinculoDireto.objects.get()
        self.assertEqual(convite.status, StatusConvite.PENDENTE)
        self.assertEqual(convite.coordenador_solicitante, self.coordenador)

    def test_bloqueia_bolsa_de_outro_coordenador(self):
        outro_perfil = CoordenadorProjeto.objects.create(
            usuario=Usuario.objects.create_user(
                username="outro", email="outro@example.com", role=Usuario.Role.COORDENADOR_PROJETO
            )
        )
        outro_projeto = Projeto.objects.create(
            titulo="Outro projeto", coordenador_projeto=outro_perfil
        )
        bolsa_de_outro = Bolsa.objects.create(
            projeto=outro_projeto,
            edital=self.edital,
            tipo="ENSINO",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            status=StatusBolsa.ABERTA,
        )
        response = self.client.post(
            reverse("vinculo_direto:convites"), {"bolsa": bolsa_de_outro.id, "aluno": self.aluno.id}
        )
        self.assertEqual(response.status_code, 400)

    def test_bloqueia_bolsa_nao_elegivel(self):
        self.edital.data_recurso_homologacao_fim = timezone.localdate() + timedelta(days=5)
        self.edital.save()
        response = self.client.post(reverse("vinculo_direto:convites"), self._payload())
        self.assertEqual(response.status_code, 400)

    def test_bloqueia_aluno_com_outro_papel(self):
        response = self.client.post(
            reverse("vinculo_direto:convites"),
            {"bolsa": self.bolsa.id, "aluno": self.coordenador_area.id},
        )
        self.assertEqual(response.status_code, 400)

    def test_bloqueia_convite_duplicado_ativo(self):
        self.client.post(reverse("vinculo_direto:convites"), self._payload())
        response = self.client.post(reverse("vinculo_direto:convites"), self._payload())
        self.assertEqual(response.status_code, 400)

    def test_cancelar_convite_pendente(self):
        resposta = self.client.post(reverse("vinculo_direto:convites"), self._payload())
        pk = resposta.data["id"]
        response = self.client.post(reverse("vinculo_direto:convite-cancelar", kwargs={"pk": pk}))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(ConviteVinculoDireto.objects.exists())

    def test_nao_cancela_convite_ja_aceito(self):
        resposta = self.client.post(reverse("vinculo_direto:convites"), self._payload())
        pk = resposta.data["id"]
        convite = ConviteVinculoDireto.objects.get(pk=pk)
        convite.status = StatusConvite.EM_PREENCHIMENTO
        convite.save()
        response = self.client.post(reverse("vinculo_direto:convite-cancelar", kwargs={"pk": pk}))
        self.assertEqual(response.status_code, 400)


class FluxoAlunoTests(VinculoDiretoTestBase):
    def setUp(self):
        super().setUp()
        self.convite = ConviteVinculoDireto.objects.create(
            bolsa=self.bolsa,
            aluno=self.aluno,
            coordenador_solicitante=self.coordenador,
            status=StatusConvite.PENDENTE,
        )
        self.client.force_authenticate(self.aluno)

    def url(self, acao):
        return reverse(f"vinculo_direto:{acao}", kwargs={"pk": self.convite.pk})

    def test_aceitar_convite(self):
        response = self.client.post(self.url("convite-aceitar"))
        self.assertEqual(response.status_code, 200)
        self.convite.refresh_from_db()
        self.assertEqual(self.convite.status, StatusConvite.EM_PREENCHIMENTO)
        self.assertIsNotNone(self.convite.data_resposta_aluno)

    def test_recusar_convite_libera_vaga(self):
        response = self.client.post(self.url("convite-recusar"))
        self.assertEqual(response.status_code, 200)
        self.convite.refresh_from_db()
        self.assertEqual(self.convite.status, StatusConvite.RECUSADO)
        self.assertEqual(vagas_livres(self.bolsa), 1)

    def test_nao_responde_convite_duas_vezes(self):
        self.client.post(self.url("convite-aceitar"))
        response = self.client.post(self.url("convite-recusar"))
        self.assertEqual(response.status_code, 400)

    def test_enviar_sem_aceitar_e_bloqueado(self):
        response = self.client.post(self.url("convite-enviar"))
        self.assertEqual(response.status_code, 400)

    def test_enviar_sem_documentos_obrigatorios_e_bloqueado(self):
        self.client.post(self.url("convite-aceitar"))
        self.client.patch(self.url("convite-detalhe"), {"termos_aceitos": True}, format="json")
        response = self.client.post(self.url("convite-enviar"))
        self.assertEqual(response.status_code, 400)

    def test_envia_com_termos_e_documentos(self):
        self.client.post(self.url("convite-aceitar"))
        self.client.patch(self.url("convite-detalhe"), {"termos_aceitos": True}, format="json")
        for tipo in [TipoDocumento.HISTORICO_ESCOLAR, TipoDocumento.COMPROVANTE_MATRICULA]:
            self.convite.documentos.create(tipo=tipo, arquivo="teste.pdf")
        response = self.client.post(self.url("convite-enviar"))
        self.assertEqual(response.status_code, 200)
        self.convite.refresh_from_db()
        self.assertEqual(self.convite.status, StatusConvite.ENVIADO)
        self.assertIsNotNone(self.convite.data_envio_documentos)

    def test_nao_edita_convite_pendente(self):
        response = self.client.patch(
            self.url("convite-detalhe"), {"termos_aceitos": True}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_outro_aluno_nao_acessa_convite(self):
        outro = Usuario.objects.create_user(
            username="outro_aluno", email="outro_aluno@example.com", role=Usuario.Role.ALUNO
        )
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.get(self.url("convite-detalhe")).status_code, 404)

    def test_edita_documentos_apos_envio_e_antes_da_aprovacao(self):
        self.client.post(self.url("convite-aceitar"))
        self.client.patch(self.url("convite-detalhe"), {"termos_aceitos": True}, format="json")
        for tipo in [TipoDocumento.HISTORICO_ESCOLAR, TipoDocumento.COMPROVANTE_MATRICULA]:
            self.convite.documentos.create(tipo=tipo, arquivo="teste.pdf")
        self.client.post(self.url("convite-enviar"))
        self.convite.refresh_from_db()
        self.assertEqual(self.convite.status, StatusConvite.ENVIADO)

        response = self.client.patch(
            self.url("convite-detalhe"), {"link_lattes": "http://lattes.cnpq.br/999"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.convite.refresh_from_db()
        self.assertEqual(self.convite.link_lattes, "http://lattes.cnpq.br/999")

        historico = self.convite.documentos.get(tipo=TipoDocumento.HISTORICO_ESCOLAR)
        response = self.client.delete(
            reverse("vinculo_direto:documento-detalhe", kwargs={"pk": historico.pk})
        )
        self.assertEqual(response.status_code, 204)
        self.assertEqual(
            self.convite.documentos.filter(tipo=TipoDocumento.HISTORICO_ESCOLAR).count(), 0
        )

    def test_nao_edita_documentos_apos_aprovacao(self):
        self.client.post(self.url("convite-aceitar"))
        self.client.patch(self.url("convite-detalhe"), {"termos_aceitos": True}, format="json")
        for tipo in [TipoDocumento.HISTORICO_ESCOLAR, TipoDocumento.COMPROVANTE_MATRICULA]:
            self.convite.documentos.create(tipo=tipo, arquivo="teste.pdf")
        self.client.post(self.url("convite-enviar"))
        self.convite.status = StatusConvite.APROVADO
        self.convite.save()

        response = self.client.patch(
            self.url("convite-detalhe"), {"link_lattes": "http://lattes.cnpq.br/999"}, format="json"
        )
        self.assertEqual(response.status_code, 400)


class DecisaoCoordenadorTests(VinculoDiretoTestBase):
    def setUp(self):
        super().setUp()
        self.convite = ConviteVinculoDireto.objects.create(
            bolsa=self.bolsa,
            aluno=self.aluno,
            coordenador_solicitante=self.coordenador,
            status=StatusConvite.ENVIADO,
            termos_aceitos=True,
        )
        for tipo in [TipoDocumento.HISTORICO_ESCOLAR, TipoDocumento.COMPROVANTE_MATRICULA]:
            self.convite.documentos.create(tipo=tipo, arquivo="teste.pdf")
        self.client.force_authenticate(self.coordenador)

    def url(self, acao):
        return reverse(f"vinculo_direto:{acao}", kwargs={"pk": self.convite.pk})

    def test_aprovar_efetiva_vinculo_e_preenche_bolsa(self):
        response = self.client.post(self.url("convite-aprovar"))
        self.assertEqual(response.status_code, 200)
        self.convite.refresh_from_db()
        self.bolsa.refresh_from_db()
        self.assertEqual(self.convite.status, StatusConvite.APROVADO)
        self.assertEqual(self.convite.responsavel_decisao, self.coordenador)
        self.assertEqual(self.bolsa.status, StatusBolsa.PREENCHIDA)

    def test_aprovar_registra_log_de_vinculo(self):
        self.client.post(self.url("convite-aprovar"))

        log = LogAuditoria.objects.get()
        self.assertEqual(log.acao, AcaoAuditoria.VINCULO)
        self.assertEqual(log.entidade, EntidadeAuditoria.BOLSA)
        self.assertEqual(log.entidade_id, str(self.bolsa.pk))
        self.assertEqual(log.usuario, self.coordenador)

    def test_aprovar_notifica_coordenador_de_area(self):
        self.client.post(self.url("convite-aprovar"))
        self.assertEqual(NotificacaoConvite.objects.count(), 1)
        notificacao = NotificacaoConvite.objects.get()
        self.assertEqual(notificacao.coordenador_area, self.coordenador_area)
        self.assertIn(self.projeto.titulo, notificacao.mensagem)

    def test_aprovar_bloqueia_sem_documentos_obrigatorios(self):
        self.convite.documentos.all().delete()
        response = self.client.post(self.url("convite-aprovar"))
        self.assertEqual(response.status_code, 400)

    def test_rejeitar_solicitando_reenvio_volta_para_preenchimento(self):
        response = self.client.post(
            self.url("convite-rejeitar"),
            {"justificativa": "Comprovante ilegível.", "definitivo": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.convite.refresh_from_db()
        self.assertEqual(self.convite.status, StatusConvite.EM_PREENCHIMENTO)
        self.assertEqual(self.convite.justificativa_rejeicao, "Comprovante ilegível.")

    def test_rejeitar_definitivo_libera_vaga(self):
        response = self.client.post(
            self.url("convite-rejeitar"),
            {"justificativa": "Documentação incompatível.", "definitivo": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.convite.refresh_from_db()
        self.assertEqual(self.convite.status, StatusConvite.REJEITADO)
        self.assertEqual(vagas_livres(self.bolsa), 1)

    def test_outro_coordenador_nao_decide(self):
        outro = Usuario.objects.create_user(
            username="outro_coord",
            email="outro_coord@example.com",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        CoordenadorProjeto.objects.create(usuario=outro)
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.post(self.url("convite-aprovar")).status_code, 404)


class BolsasElegiveisEBuscaAlunoTests(VinculoDiretoTestBase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.coordenador)

    def test_lista_apenas_bolsas_elegiveis(self):
        bolsa_nao_elegivel = Bolsa.objects.create(
            projeto=self.projeto,
            edital=_edital(
                ano_codigo="2026-004",
                data_recurso_homologacao_fim=timezone.localdate() + timedelta(days=5),
            ),
            tipo="ENSINO",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            status=StatusBolsa.ABERTA,
        )
        response = self.client.get(reverse("vinculo_direto:bolsas-elegiveis"))
        ids = [item["id"] for item in response.data]
        self.assertIn(self.bolsa.id, ids)
        self.assertNotIn(bolsa_nao_elegivel.id, ids)

    def test_busca_aluno_por_nome_ou_email(self):
        self.aluno.nome = "Maria Teste"
        self.aluno.save()
        response = self.client.get(reverse("vinculo_direto:alunos-busca"), {"q": "Maria"})
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["email"], self.aluno.email)

    def test_busca_curta_nao_retorna_nada(self):
        response = self.client.get(reverse("vinculo_direto:alunos-busca"), {"q": "ma"})
        self.assertEqual(response.data, [])

    def test_aluno_nao_acessa_bolsas_elegiveis(self):
        self.client.force_authenticate(self.aluno)
        self.assertEqual(
            self.client.get(reverse("vinculo_direto:bolsas-elegiveis")).status_code, 403
        )
