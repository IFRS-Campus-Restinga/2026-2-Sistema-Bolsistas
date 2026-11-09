from datetime import timedelta
from importlib import import_module
from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import CoordenadorArea, CoordenadorProjeto, TipoArea, Usuario
from bolsas.models import Bolsa, StatusBolsa, TipoBolsa
from bolsistas.models import OrigemVinculo, VinculoBolsista
from editais.models import Edital
from inscricoes.models import Inscricao, Recurso, StatusInscricao
from projetos.models import Projeto
from selecao.models import IndicacaoBolsista

from .models import Notificacao as NotificacaoModel
from .models import TomNotificacao
from .pendencias import verificar_pendencias
from .services import Destino, Notificacao, coordenadores_da_area

migracao = import_module("notificacoes.migrations.0002_migrar_notificacoes_antigas")


def usuario(nome, role, **campos):
    return Usuario.objects.create_user(
        username=nome, email=f"{nome}@example.com", nome=nome.title(), role=role, **campos
    )


def coordenador_area(nome, tipo_area):
    coordenador = usuario(nome, Usuario.Role.COORDENADOR_AREA)
    CoordenadorArea.objects.create(usuario=coordenador, tipo_area=tipo_area)
    return coordenador


class Cenario:
    """Edital em vigor, projeto e bolsa solicitada, com um coordenador de cada tipo."""

    def montar_cenario(self):
        self.coord_projeto = usuario("projeto", Usuario.Role.COORDENADOR_PROJETO)
        self.projeto = Projeto.objects.create(
            titulo="Robótica",
            coordenador_projeto=CoordenadorProjeto.objects.create(usuario=self.coord_projeto),
        )
        hoje = timezone.localdate()
        self.edital = Edital.objects.create(
            nome="Edital",
            ano_codigo="2026-001",
            link_documento_oficial="https://example.com/edital",
            status=Edital.Status.EM_VIGOR,
            data_recurso_homologacao_inicio=hoje - timedelta(days=5),
            data_recurso_homologacao_fim=hoje - timedelta(days=1),
        )
        self.bolsa = Bolsa.objects.create(
            projeto=self.projeto,
            edital=self.edital,
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
        )
        self.coord_pesquisa = coordenador_area("pesquisa", TipoArea.PESQUISA)
        self.coord_ensino = coordenador_area("ensino", TipoArea.ENSINO)
        self.admin = usuario("admin", Usuario.Role.ADMINISTRADOR)


class ConstrutorNotificacaoTests(TestCase):
    def setUp(self):
        self.ana = usuario("ana", Usuario.Role.ALUNO)
        self.bia = usuario("bia", Usuario.Role.ALUNO)

    def test_monta_notificacao_com_todos_os_campos(self):
        criadas = (
            Notificacao.para(self.ana)
            .sucesso()
            .titulo("Inscrição homologada")
            .mensagem("Sua inscrição foi homologada.")
            .destino(Destino.ALUNO_INSCRICOES)
            .enviar()
        )

        self.assertEqual(len(criadas), 1)
        notificacao = NotificacaoModel.objects.get()
        self.assertEqual(notificacao.destinatario, self.ana)
        self.assertEqual(notificacao.tom, TomNotificacao.SUCESSO)
        self.assertEqual(notificacao.titulo, "Inscrição homologada")
        self.assertEqual(notificacao.destino, "inscricoes")
        self.assertIsNotNone(notificacao.criada_em)
        self.assertIsNone(notificacao.lida_em)

    def test_aceita_listas_perfis_e_ignora_nulos_e_repetidos(self):
        perfil = CoordenadorProjeto.objects.create(
            usuario=usuario("coord", Usuario.Role.COORDENADOR_PROJETO)
        )

        Notificacao.para([self.ana, self.bia], perfil, None, self.ana).titulo("T").mensagem(
            "M"
        ).enviar()

        self.assertEqual(
            set(NotificacaoModel.objects.values_list("destinatario__username", flat=True)),
            {"ana", "bia", "coord"},
        )

    def test_sem_destinatarios_nao_cria_nada(self):
        self.assertEqual(Notificacao.para(None).titulo("T").mensagem("M").enviar(), [])
        self.assertFalse(NotificacaoModel.objects.exists())

    def test_exige_titulo_e_mensagem(self):
        with self.assertRaises(ValueError):
            Notificacao.para(self.ana).titulo("Só título").enviar()
        with self.assertRaises(ValueError):
            Notificacao.para(self.ana).mensagem("Só mensagem").enviar()

    def test_rejeita_tom_e_destinatario_invalidos(self):
        with self.assertRaises(ValueError):
            Notificacao.para(self.ana).tom("URGENTE")
        with self.assertRaises(TypeError):
            Notificacao.para("ana")

    def test_chave_evita_repetir_aviso_ao_mesmo_destinatario(self):
        def avisar(*destinatarios):
            return (
                Notificacao.para(*destinatarios).aviso().titulo("T").mensagem("M").chave("x:1")
            ).enviar()

        self.assertEqual(len(avisar(self.ana)), 1)
        self.assertEqual(len(avisar(self.ana, self.bia)), 1)
        self.assertEqual(NotificacaoModel.objects.filter(chave="x:1").count(), 2)

    def test_coordenadores_da_area_por_tipo_e_indissociavel(self):
        pesquisa = coordenador_area("pesquisa", TipoArea.PESQUISA)
        ensino = coordenador_area("ensino", TipoArea.ENSINO)
        inativo = coordenador_area("inativo", TipoArea.PESQUISA)
        inativo.is_active = False
        inativo.save()

        self.assertEqual(list(coordenadores_da_area(TipoBolsa.PESQUISA)), [pesquisa])
        self.assertEqual(set(coordenadores_da_area(TipoBolsa.INDISSOCIAVEL)), {pesquisa, ensino})


class NotificacoesAPITests(APITestCase):
    def setUp(self):
        self.ana = usuario("ana", Usuario.Role.ALUNO)
        self.bia = usuario("bia", Usuario.Role.ALUNO)
        self.lida = NotificacaoModel.objects.create(
            destinatario=self.ana,
            titulo="Antiga",
            mensagem="Já lida",
            criada_em=timezone.now() - timedelta(days=1),
            lida_em=timezone.now(),
        )
        self.nova = NotificacaoModel.objects.create(
            destinatario=self.ana, titulo="Nova", mensagem="Não lida", destino="inscricoes"
        )
        self.de_outro = NotificacaoModel.objects.create(
            destinatario=self.bia, titulo="Outra", mensagem="De outra aluna"
        )
        self.client.force_authenticate(self.ana)

    def test_lista_apenas_do_usuario_logado_mais_recentes_primeiro(self):
        response = self.client.get(reverse("notificacoes:lista"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["nao_lidas"], 1)
        self.assertEqual(
            [item["id"] for item in response.data["resultados"]], [self.nova.id, self.lida.id]
        )
        self.assertEqual(response.data["resultados"][0]["destino"], "inscricoes")

    def test_filtra_nao_lidas(self):
        response = self.client.get(reverse("notificacoes:lista"), {"nao_lidas": "1"})

        self.assertEqual([item["id"] for item in response.data["resultados"]], [self.nova.id])
        self.assertEqual(response.data["nao_lidas"], 1)

    def test_marca_uma_como_lida_sem_alterar_a_primeira_leitura(self):
        url = reverse("notificacoes:ler", kwargs={"pk": self.nova.pk})

        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.nova.refresh_from_db()
        primeira = self.nova.lida_em
        self.assertIsNotNone(primeira)

        self.client.post(url)
        self.nova.refresh_from_db()
        self.assertEqual(self.nova.lida_em, primeira)

    def test_nao_marca_notificacao_de_outro_usuario(self):
        url = reverse("notificacoes:ler", kwargs={"pk": self.de_outro.pk})

        self.assertEqual(self.client.post(url).status_code, 404)
        self.de_outro.refresh_from_db()
        self.assertIsNone(self.de_outro.lida_em)

    def test_marca_todas_como_lidas_apenas_do_usuario(self):
        NotificacaoModel.objects.create(destinatario=self.ana, titulo="Mais", mensagem="Uma")

        response = self.client.post(reverse("notificacoes:ler-todas"))

        self.assertEqual(response.data["atualizadas"], 2)
        self.assertFalse(
            NotificacaoModel.objects.filter(destinatario=self.ana, lida_em__isnull=True).exists()
        )
        self.de_outro.refresh_from_db()
        self.assertIsNone(self.de_outro.lida_em)

    def test_qualquer_perfil_autenticado_acessa_e_visitante_nao(self):
        for role in Usuario.Role.values:
            with self.subTest(role=role):
                self.client.force_authenticate(usuario(f"u_{role.lower()}", role))
                self.assertEqual(self.client.get(reverse("notificacoes:lista")).status_code, 200)

        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("notificacoes:lista")).status_code, 401)
        self.assertEqual(self.client.post(reverse("notificacoes:ler-todas")).status_code, 401)


@override_settings(PRAZO_ANALISE_SOLICITACAO_BOLSA_DIAS=5)
class PendenciasAdministradorTests(Cenario, APITestCase):
    def setUp(self):
        self.montar_cenario()
        Bolsa.objects.filter(pk=self.bolsa.pk).update(
            data_solicitacao=timezone.now() - timedelta(days=6)
        )
        aluno = usuario("ana", Usuario.Role.ALUNO)
        inscricao = Inscricao.objects.create(
            aluno=aluno, bolsa=self.bolsa, status=StatusInscricao.INDEFERIDA
        )
        self.recurso = Recurso.objects.create(inscricao=inscricao, justificativa="Revisem")

    def avisos(self, chave_prefixo):
        return NotificacaoModel.objects.filter(
            destinatario=self.admin, chave__startswith=chave_prefixo
        )

    def test_avisa_solicitacao_parada_e_recurso_sem_julgamento_uma_vez(self):
        self.assertEqual(verificar_pendencias(), 2)
        self.assertEqual(verificar_pendencias(), 0)

        bolsa = self.avisos("bolsa-parada:").get()
        self.assertEqual(bolsa.destino, Destino.ADMIN_BOLSAS)
        self.assertIn("Robótica", bolsa.mensagem)
        self.assertEqual(self.avisos("recurso-parado:").get().destino, Destino.ADMIN_INSCRICOES)

    def test_respeita_o_prazo_configurado(self):
        with override_settings(PRAZO_ANALISE_SOLICITACAO_BOLSA_DIAS=10):
            verificar_pendencias()

        self.assertFalse(self.avisos("bolsa-parada:").exists())

    def test_nao_avisa_itens_resolvidos_ou_dentro_do_prazo(self):
        self.bolsa.status = StatusBolsa.ABERTA
        self.bolsa.save(update_fields=["status"])
        self.edital.data_recurso_homologacao_fim = timezone.localdate()
        self.edital.save(update_fields=["data_recurso_homologacao_fim"])

        self.assertEqual(verificar_pendencias(), 0)

    def test_consulta_do_administrador_dispara_a_verificacao(self):
        self.client.force_authenticate(self.admin)

        response = self.client.get(reverse("notificacoes:lista"))

        self.assertEqual(response.data["nao_lidas"], 2)

    def test_consulta_de_outros_perfis_nao_dispara(self):
        self.client.force_authenticate(self.coord_projeto)
        self.client.get(reverse("notificacoes:lista"))

        self.assertFalse(NotificacaoModel.objects.filter(destinatario=self.admin).exists())

    def test_comando_agendavel(self):
        saida = StringIO()

        call_command("verificar_pendencias", stdout=saida)

        self.assertIn("2 notificação(ões) criada(s)", saida.getvalue())


class FluxosNotificacaoTests(Cenario, APITestCase):
    def setUp(self):
        self.montar_cenario()

    def notificacoes(self, destinatario):
        return NotificacaoModel.objects.filter(destinatario=destinatario)

    def test_aprovar_bolsa_notifica_coordenador_do_projeto(self):
        self.client.force_authenticate(self.coord_pesquisa)

        self.client.post(reverse("bolsas:aprovar", kwargs={"pk": self.bolsa.pk}))

        notificacao = self.notificacoes(self.coord_projeto).get()
        self.assertEqual(notificacao.titulo, "Bolsa aprovada")
        self.assertEqual(notificacao.destino, Destino.PROJETO_PROJETOS)

    def test_rejeitar_bolsa_notifica_com_justificativa(self):
        self.client.force_authenticate(self.coord_pesquisa)

        self.client.post(
            reverse("bolsas:rejeitar", kwargs={"pk": self.bolsa.pk}),
            {"justificativa": "Sem orçamento"},
        )

        notificacao = self.notificacoes(self.coord_projeto).get()
        self.assertEqual(notificacao.tom, TomNotificacao.ERRO)
        self.assertIn("Sem orçamento", notificacao.mensagem)

    def test_desligamento_pelo_coordenador_notifica_aluno_e_area(self):
        self.bolsa.status = StatusBolsa.PREENCHIDA
        self.bolsa.coordenador_area = self.coord_pesquisa.perfil_coordenador_area
        self.bolsa.save()
        aluno = usuario("ana", Usuario.Role.ALUNO)
        inscricao = Inscricao.objects.create(
            aluno=aluno, bolsa=self.bolsa, status=StatusInscricao.HOMOLOGADA
        )
        indicacao = IndicacaoBolsista.objects.create(
            bolsa=self.bolsa, inscricao=inscricao, responsavel=self.coord_projeto
        )
        vinculo = VinculoBolsista.objects.create(
            bolsa=self.bolsa, aluno=aluno, origem=OrigemVinculo.SELECAO, indicacao=indicacao
        )
        self.client.force_authenticate(self.coord_projeto)

        response = self.client.post(
            reverse("bolsistas:desligar-vinculo", kwargs={"pk": vinculo.pk}),
            {"motivo": "Concluiu o curso"},
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.notificacoes(aluno).get().destino, Destino.ALUNO_MINHA_BOLSA)
        area = self.notificacoes(self.coord_pesquisa).get()
        self.assertEqual(area.destino, Destino.AREA_MOVIMENTACOES)
        self.assertFalse(self.notificacoes(self.coord_ensino).exists())


class MigracaoNotificacoesAntigasTests(TestCase):
    def test_classifica_mensagens_antigas(self):
        casos = {
            'Sua inscrição no projeto "X" foi homologada.': ("Inscrição homologada", "SUCESSO"),
            'Sua inscrição no projeto "X" foi indeferida. Motivo: y': (
                "Inscrição indeferida",
                "ERRO",
            ),
            'Seu recurso de homologação, na bolsa do projeto "X", foi deferido.': (
                "Recurso deferido",
                "SUCESSO",
            ),
            "Outra mensagem qualquer": ("Atualização da inscrição", "INFO"),
        }
        for mensagem, (titulo, tom) in casos.items():
            with self.subTest(mensagem=mensagem):
                self.assertEqual(migracao._classificar(mensagem)[:2], (titulo, tom))

    def test_remove_ids_das_mensagens_antigas_preservando_justificativa(self):
        texto = migracao._texto_atual(
            "Seu recurso #2 de homologação, na bolsa #6, foi indeferido. Justificativa: item #7.",
            "Projeto",
        )

        self.assertNotIn("#2", texto)
        self.assertNotIn("#6", texto)
        self.assertIn('na bolsa do projeto "Projeto"', texto)
        self.assertIn("item #7", texto)
