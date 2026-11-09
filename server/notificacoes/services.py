"""Serviço único de notificações: todas as funcionalidades disparam por aqui.

Uso:
    Notificacao.para(inscricao.aluno).sucesso().titulo("Inscrição homologada").mensagem(
        f'Sua inscrição no projeto "{titulo}" foi homologada.'
    ).destino(Destino.ALUNO_INSCRICOES).enviar()

`para` aceita usuários, perfis (com `.usuario`), listas/querysets ou None (ignorado).
As notificações são gravadas na transação da view: se a ação falhar, nada é enviado.
"""

from collections.abc import Iterable

from accounts.models import Usuario
from bolsas.models import TipoBolsa

from . import models
from .models import TomNotificacao


class Destino:
    """Ids das abas de cada perfil que o clique na notificação abre."""

    ALUNO_INSCRICOES = "inscricoes"
    ALUNO_RECURSOS = "recursos"
    ALUNO_CONVITES = "convites"
    ALUNO_MINHA_BOLSA = "minha-bolsa"
    ALUNO_FREQUENCIA = "minha-frequencia"

    PROJETO_PROJETOS = "projetos"
    PROJETO_SELECAO = "selecao"
    PROJETO_CONVITES = "convites"
    PROJETO_BOLSISTAS = "bolsistas"
    PROJETO_FREQUENCIAS = "frequencias"
    PROJETO_FINALIZACAO = "finalizacao"

    AREA_SOLICITACOES = "solicitacoes"
    AREA_FINALIZACAO = "finalizacao"
    AREA_MOVIMENTACOES = "movimentacoes"

    ADMIN_BOLSAS = "bolsas"
    ADMIN_INSCRICOES = "inscricoes"
    ADMIN_AUDITORIA = "auditoria"


def _usuarios(destinatarios):
    vistos = {}
    pendentes = list(destinatarios)
    while pendentes:
        item = pendentes.pop(0)
        if item is None:
            continue
        if isinstance(item, Usuario):
            vistos.setdefault(item.pk, item)
        elif hasattr(item, "usuario"):
            pendentes.append(item.usuario)
        elif isinstance(item, Iterable) and not isinstance(item, str):
            pendentes.extend(item)
        else:
            raise TypeError(f"Destinatário inválido para notificação: {item!r}")
    return list(vistos.values())


class Notificacao:
    """Construtor de notificações: monte com os métodos encadeados e chame `enviar()`."""

    def __init__(self, destinatarios):
        self._destinatarios = _usuarios(destinatarios)
        self._tom = TomNotificacao.INFO
        self._titulo = ""
        self._mensagem = ""
        self._destino = ""
        self._chave = ""

    @classmethod
    def para(cls, *destinatarios):
        return cls(destinatarios)

    def tom(self, tom):
        self._tom = TomNotificacao(tom)
        return self

    def info(self):
        return self.tom(TomNotificacao.INFO)

    def sucesso(self):
        return self.tom(TomNotificacao.SUCESSO)

    def aviso(self):
        return self.tom(TomNotificacao.AVISO)

    def erro(self):
        return self.tom(TomNotificacao.ERRO)

    def titulo(self, titulo):
        self._titulo = titulo
        return self

    def mensagem(self, mensagem):
        self._mensagem = mensagem
        return self

    def destino(self, destino):
        self._destino = destino
        return self

    def chave(self, chave):
        """Avisos com chave não se repetem para quem já recebeu a mesma chave."""
        self._chave = chave
        return self

    def enviar(self):
        if not self._titulo or not self._mensagem:
            raise ValueError("Toda notificação precisa de título e mensagem.")

        destinatarios = self._destinatarios
        if self._chave:
            ja_avisados = set(
                models.Notificacao.objects.filter(
                    chave=self._chave, destinatario__in=destinatarios
                ).values_list("destinatario_id", flat=True)
            )
            destinatarios = [usuario for usuario in destinatarios if usuario.pk not in ja_avisados]

        return models.Notificacao.objects.bulk_create(
            models.Notificacao(
                destinatario=usuario,
                tom=self._tom,
                titulo=self._titulo,
                mensagem=self._mensagem,
                destino=self._destino,
                chave=self._chave,
            )
            for usuario in destinatarios
        )


def coordenador_do_projeto(bolsa):
    return bolsa.projeto.coordenador_projeto.usuario


def coordenadores_da_area(tipo_bolsa):
    """Coordenadores de área que analisam bolsas do tipo; Indissociável vai para todos."""
    coordenadores = Usuario.objects.filter(
        role=Usuario.Role.COORDENADOR_AREA, is_active=True, perfil_coordenador_area__isnull=False
    )
    if tipo_bolsa != TipoBolsa.INDISSOCIAVEL:
        coordenadores = coordenadores.filter(perfil_coordenador_area__tipo_area=tipo_bolsa)
    return coordenadores


def coordenadores_da_bolsa(bolsa):
    """Quem decidiu a bolsa; antes da decisão, os coordenadores da área do tipo dela."""
    if bolsa.coordenador_area_id:
        return [bolsa.coordenador_area.usuario]
    return coordenadores_da_area(bolsa.tipo)


def administradores():
    return Usuario.objects.filter(role=Usuario.Role.ADMINISTRADOR, is_active=True)
