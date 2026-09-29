"""Serializers de leitura para os endpoints de auditoria."""

from auditlog.models import LogEntry
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import serializers

from editais.models import AlteracaoCronograma

# Mapeamento de ação numérica → display pt-BR
_ACAO_DISPLAY = {
    LogEntry.Action.CREATE: "Criação",
    LogEntry.Action.UPDATE: "Alteração",
    LogEntry.Action.DELETE: "Exclusão",
    LogEntry.Action.ACCESS: "Acesso",
}

_ROTULOS_CAMPOS = {
    "status": "Status",
    "email": "E-mail",
    "tipo_area": "Área",
    "usuario": "Usuário",
    "role": "Perfil",
    "is_active": "Ativo",
    "is_staff": "Equipe",
    "is_superuser": "Superusuário",
    "nome": "Nome",
    "username": "Login",
    "first_name": "Primeiro nome",
    "last_name": "Sobrenome",
    "date_joined": "Data de cadastro",
    "last_login": "Último login",
    "nome_original": "Nome do arquivo",
    "recurso": "Recurso vinculado",
}

_ROTULOS_MODELO = {
    "usuario": "Usuário",
    "coordenadorarea": "Coordenador de Área",
    "emailcoordenadorarea": "E-mail de Coordenador de Área",
    "inscricao": "Inscrição",
}

_CAMPOS_TECNICOS_IGNORADOS = {
    "password",
    "last_login",
    "is_superuser",
    "first_name",
    "last_name",
    "is_staff",
    "date_joined",
    "inscricoes",
    "inscricoes_analisadas",
    "recursos_julgados",
    "frequencias_lancadas",
    "vinculos_bolsista",
    "alteracoes_cronograma",
    "bolsas_avaliadas",
    "arquivo",
    "enviado_em",
    "criada_em",
    "criado_em",
    "julgado_em",
}

_CAMPOS_RELEVANTES_POR_MODELO = {
    "usuario": {"nome", "email", "username", "role", "is_active"},
    "emailcoordenadorarea": {"email", "tipo_area"},
    "coordenadorarea": {"tipo_area", "usuario"},
    "inscricao": {"status", "justificativa_indeferimento"},
    "documento": {"nome_original"},
    "notificacaoinscricao": {"mensagem"},
    "anexorecurso": {"nome_original", "recurso"},
    "recurso": {
        "status",
        "etapa",
        "justificativa",
        "motivo_contestado",
        "justificativa_julgamento",
    },
}

_CAMPOS_IDENTIFICACAO_RECURSO = {
    "usuario": ["nome", "email", "username"],
    "emailcoordenadorarea": ["email"],
    "coordenadorarea": ["usuario"],
    "inscricao": ["bolsa"],
    "edital": ["nome", "ano_codigo"],
}

_CAMPOS_DUPLICADOS_NO_RECURSO_POR_ACAO = {
    LogEntry.Action.CREATE: {
        "inscricao": {"status"},
        "recurso": {"etapa"},
        "etapaavaliacao": {"nome"},
    }
}


class LogEntrySerializer(serializers.ModelSerializer):
    ator = serializers.SerializerMethodField()
    acao = serializers.SerializerMethodField()
    recurso = serializers.SerializerMethodField()
    detalhe = serializers.SerializerMethodField()
    registro_original = serializers.SerializerMethodField()
    registro_alterado = serializers.SerializerMethodField()
    timestamp = serializers.DateTimeField(format="%d/%m/%Y %H:%M:%S")

    class Meta:
        model = LogEntry
        fields = [
            "id",
            "timestamp",
            "ator",
            "acao",
            "recurso",
            "registro_original",
            "registro_alterado",
            "detalhe",
        ]

    @staticmethod
    def _rotulo_campo(campo):
        if campo in _ROTULOS_CAMPOS:
            return _ROTULOS_CAMPOS[campo]
        return str(campo).replace("_", " ")

    @staticmethod
    def _valor_vazio(valor):
        if valor in (None, "", "None", "null"):
            return True
        if isinstance(valor, str):
            txt = valor.strip().lower()
            if txt in {"none", "null", "nan"}:
                return True
            if txt.endswith(".none"):
                return True
        return False

    def _valor_texto(self, entrada, campo, valor):
        if self._valor_vazio(valor):
            return "(vazio)"

        if isinstance(valor, bool):
            return "Sim" if valor else "Não"

        if isinstance(valor, str):
            if valor == "True":
                return "Sim"
            if valor == "False":
                return "Não"

        texto_data_hora = None
        if isinstance(valor, str):
            dt = parse_datetime(valor)
            if dt:
                texto_data_hora = dt.strftime("%d/%m/%Y %H:%M:%S")
            else:
                d = parse_date(valor)
                if d:
                    texto_data_hora = d.strftime("%d/%m/%Y")
        if texto_data_hora:
            return texto_data_hora

        modelo = entrada.content_type.model_class()
        if modelo is not None:
            try:
                campo_modelo = modelo._meta.get_field(campo)
            except Exception:
                campo_modelo = None

            if campo_modelo is not None:
                if getattr(campo_modelo, "choices", None):
                    mapa_choices = dict(campo_modelo.flatchoices)
                    if valor in mapa_choices:
                        return str(mapa_choices[valor])
                    if str(valor) in mapa_choices:
                        return str(mapa_choices[str(valor)])

                if getattr(campo_modelo, "is_relation", False):
                    related_model = getattr(
                        getattr(campo_modelo, "remote_field", None), "model", None
                    )
                    if related_model is not None:
                        try:
                            objeto = related_model.objects.filter(pk=valor).first()
                            if objeto is not None:
                                return str(objeto)
                        except Exception:
                            pass

        return str(valor)

    def _campos_crud(self, entrada):
        mudancas = entrada.changes_dict or {}
        modelo = entrada.content_type.model
        campos_relevantes = _CAMPOS_RELEVANTES_POR_MODELO.get(modelo)

        campos = []
        for campo in mudancas:
            if campo in ("acao", "detalhe", "history_id", "id"):
                continue
            if campo in _CAMPOS_TECNICOS_IGNORADOS:
                continue
            if campos_relevantes is not None and campo not in campos_relevantes:
                continue
            if self._campo_duplicado_no_recurso(entrada, campo):
                continue
            campos.append(campo)

        return campos

    def _campo_duplicado_no_recurso(self, entrada, campo):
        por_modelo = _CAMPOS_DUPLICADOS_NO_RECURSO_POR_ACAO.get(entrada.action, {})
        campos_duplicados = por_modelo.get(entrada.content_type.model, set())
        return campo in campos_duplicados

    def _ordenar_campos(self, campos):
        prioridade = {
            "nome": 1,
            "email": 2,
            "username": 3,
            "role": 4,
            "is_active": 5,
            "tipo_area": 6,
            "usuario": 7,
        }
        return [*sorted(campos, key=lambda campo: (prioridade.get(campo, 99), campo))]

    def _valor_mudanca_por_acao(self, entrada, valores):
        if isinstance(valores, list) and len(valores) >= 2:
            if entrada.action == LogEntry.Action.DELETE:
                return valores[0]
            return valores[1]
        return valores

    @staticmethod
    def _nome_usuario(usuario):
        if usuario is None:
            return "(desconhecido)"
        return usuario.nome or usuario.email or usuario.username or "(desconhecido)"

    def _descricao_inscricao(self, inscricao):
        if inscricao is None:
            return None

        aluno = self._nome_usuario(getattr(inscricao, "aluno", None))
        bolsa = str(getattr(inscricao, "bolsa", ""))
        status = inscricao.get_status_display()
        return f"Aluno {aluno} | Bolsa: {bolsa} | Inscrição: {status}"

    def _identificador_relacao_inscricoes(self, entrada):
        modelo_nome = entrada.content_type.model
        modelo = entrada.content_type.model_class()
        if modelo is None:
            return None

        try:
            if modelo_nome == "inscricao":
                inscricao = (
                    modelo.objects.filter(pk=entrada.object_pk)
                    .select_related("aluno", "bolsa")
                    .first()
                )
                return self._descricao_inscricao(inscricao)

            if modelo_nome == "recurso":
                recurso = (
                    modelo.objects.filter(pk=entrada.object_pk)
                    .select_related("inscricao__aluno", "inscricao__bolsa")
                    .first()
                )
                if recurso is None:
                    return None
                inscricao_txt = self._descricao_inscricao(recurso.inscricao)
                return f"{recurso.get_etapa_display()} | {inscricao_txt}"

            if modelo_nome == "documento":
                documento = (
                    modelo.objects.filter(pk=entrada.object_pk)
                    .select_related("inscricao__aluno", "inscricao__bolsa")
                    .first()
                )
                if documento is None:
                    return None
                inscricao_txt = self._descricao_inscricao(documento.inscricao)
                return f"{documento.get_tipo_display()} | {inscricao_txt}"

            if modelo_nome == "notificacaoinscricao":
                notificacao = (
                    modelo.objects.filter(pk=entrada.object_pk)
                    .select_related("inscricao__aluno", "inscricao__bolsa")
                    .first()
                )
                if notificacao is None:
                    return None
                inscricao_txt = self._descricao_inscricao(notificacao.inscricao)
                return f"{inscricao_txt}"

            if modelo_nome == "anexorecurso":
                anexo = (
                    modelo.objects.filter(pk=entrada.object_pk)
                    .select_related("recurso__inscricao__aluno", "recurso__inscricao__bolsa")
                    .first()
                )
                if anexo is None or anexo.recurso is None:
                    return None
                inscricao_txt = self._descricao_inscricao(anexo.recurso.inscricao)
                return f"{anexo.nome_original} | {inscricao_txt}"
        except Exception:
            return None

        return None

    def _identificador_recurso(self, entrada):
        identificador_relacao = self._identificador_relacao_inscricoes(entrada)
        if identificador_relacao:
            return identificador_relacao

        mudancas = entrada.changes_dict or {}
        campos = _CAMPOS_IDENTIFICACAO_RECURSO.get(entrada.content_type.model, [])

        for campo in campos:
            if campo not in mudancas:
                continue
            bruto = self._valor_mudanca_por_acao(entrada, mudancas.get(campo))
            texto = self._valor_texto(entrada, campo, bruto)
            if texto and texto != "(vazio)":
                return texto

        if entrada.content_type.model == "inscricao":
            modelo = entrada.content_type.model_class()
            if modelo is not None:
                try:
                    inscricao = (
                        modelo.objects.filter(pk=entrada.object_pk).select_related("bolsa").first()
                    )
                    if inscricao is not None and inscricao.bolsa is not None:
                        return str(inscricao.bolsa)
                except Exception:
                    pass

        if entrada.object_repr and str(entrada.object_repr).strip() not in {"", "None"}:
            return str(entrada.object_repr)

        return None

    def get_ator(self, entrada):
        if entrada.actor:
            if entrada.actor.nome:
                return entrada.actor.nome
            if entrada.actor.email:
                return entrada.actor.email
            return entrada.actor.username or "Sistema"
        return entrada.actor_email or "Sistema"

    def get_acao(self, entrada):
        mudancas = entrada.changes_dict or {}
        # Ações semânticas gravadas por registrar_acao têm a chave "acao"
        if "acao" in mudancas:
            valores = mudancas["acao"]
            return valores[1] if isinstance(valores, list) else str(valores)
        return _ACAO_DISPLAY.get(entrada.action, str(entrada.action))

    def get_recurso(self, entrada):
        modelo = entrada.content_type.model_class()
        if modelo is not None:
            nome_modelo = _ROTULOS_MODELO.get(
                entrada.content_type.model,
                modelo._meta.verbose_name.title(),
            )
        else:
            nome_modelo = _ROTULOS_MODELO.get(
                entrada.content_type.model,
                f"{entrada.content_type.app_label}.{entrada.content_type.model}",
            )

        identificador = self._identificador_recurso(entrada)
        if identificador:
            return f"{nome_modelo}: {identificador}"
        return f"{nome_modelo} #{entrada.object_pk}"

    def get_detalhe(self, entrada):
        mudancas = entrada.changes_dict or {}
        if "detalhe" in mudancas:
            valores = mudancas["detalhe"]
            return valores[1] if isinstance(valores, list) else str(valores)

        campos = self._ordenar_campos(self._campos_crud(entrada))
        if campos:
            partes = []
            for campo in campos:
                valores = mudancas.get(campo)
                if isinstance(valores, list) and len(valores) >= 2:
                    valor = self._valor_texto(entrada, campo, valores[1])
                else:
                    valor = self._valor_texto(entrada, campo, valores)
                partes.append(f"{self._rotulo_campo(campo)}: {valor}")
            if partes:
                return " | ".join(partes)

        # Fallback completo com nome + valor para qualquer campo não técnico.
        campos_alterados = [
            campo
            for campo in mudancas
            if campo not in ("acao", "detalhe", "id", "history_id")
            and campo not in _CAMPOS_TECNICOS_IGNORADOS
        ]
        if campos_alterados:
            partes = []
            for campo in self._ordenar_campos(campos_alterados):
                valores = mudancas.get(campo)
                if isinstance(valores, list) and len(valores) >= 2:
                    valor = self._valor_texto(entrada, campo, valores[1])
                else:
                    valor = self._valor_texto(entrada, campo, valores)
                partes.append(f"{self._rotulo_campo(campo)}: {valor}")
            if partes:
                return " | ".join(partes)
        return ""

    def get_registro_original(self, entrada):
        if entrada.action == LogEntry.Action.CREATE:
            return "—"

        mudancas = entrada.changes_dict or {}
        campos = self._ordenar_campos(self._campos_crud(entrada))
        if not campos:
            return "—"

        partes = []
        for campo in campos:
            valores = mudancas.get(campo)
            if isinstance(valores, list) and len(valores) >= 2:
                anterior = self._valor_texto(entrada, campo, valores[0])
            else:
                anterior = self._valor_texto(entrada, campo, valores)
            if anterior == "(vazio)":
                continue
            partes.append(f"{self._rotulo_campo(campo)}: {anterior}")
        if not partes:
            return "—"
        return " | ".join(partes)

    def get_registro_alterado(self, entrada):
        if entrada.action == LogEntry.Action.DELETE:
            return "—"

        mudancas = entrada.changes_dict or {}
        if "detalhe" in mudancas:
            valores = mudancas["detalhe"]
            return valores[1] if isinstance(valores, list) else str(valores)

        campos = self._campos_crud(entrada)
        campos = self._ordenar_campos(campos)
        if not campos:
            return "—"

        partes = []
        for campo in campos:
            valores = mudancas.get(campo)
            if isinstance(valores, list) and len(valores) >= 2:
                novo = self._valor_texto(entrada, campo, valores[1])
            else:
                novo = self._valor_texto(entrada, campo, valores)
            if novo == "(vazio)":
                continue
            partes.append(f"{self._rotulo_campo(campo)}: {novo}")
        if not partes:
            return "—"
        return " | ".join(partes)


class AlteracaoCronogramaSerializer(serializers.ModelSerializer):
    responsavel = serializers.SerializerMethodField()
    campo_display = serializers.SerializerMethodField()
    alterado_em = serializers.DateTimeField(format="%d/%m/%Y %H:%M:%S")

    class Meta:
        model = AlteracaoCronograma
        fields = [
            "id",
            "campo",
            "campo_display",
            "data_anterior",
            "data_nova",
            "responsavel",
            "alterado_em",
        ]

    def get_responsavel(self, alteracao):
        return alteracao.responsavel.nome or alteracao.responsavel.username

    def get_campo_display(self, alteracao):
        # Mapear nome interno → rótulo legível
        _CAMPOS = {
            "data_abertura_inscricoes": "Abertura das inscrições",
            "data_fechamento_inscricoes": "Fechamento das inscrições",
            "data_homologacao": "Homologação",
            "data_recurso_homologacao_inicio": "Início dos recursos",
            "data_recurso_homologacao_fim": "Fim dos recursos",
            "data_resultado": "Divulgação do resultado",
            "data_maxima_preenchimento_vagas": "Máxima de preenchimento de vagas",
            "data_entrega_relatorios": "Entrega de relatórios",
        }
        return _CAMPOS.get(alteracao.campo, alteracao.campo)
