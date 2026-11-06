from html import unescape
from io import BytesIO
from pathlib import Path

from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags
from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt

from .models import TipoTermo

BRASAO_REPUBLICA = Path(__file__).resolve().parent / "assets" / "brasao_republica.jpg"


def calcular_idade(data_nascimento, referencia=None):
    referencia = referencia or timezone.localdate()
    return (
        referencia.year
        - data_nascimento.year
        - ((referencia.month, referencia.day) < (data_nascimento.month, data_nascimento.day))
    )


def contexto_termo(vinculo, perfil):
    bolsa = vinculo.bolsa
    return {
        "aluno_nome": vinculo.aluno.nome,
        "matricula": perfil.matricula or "não informada",
        "curso": perfil.curso or "não informado",
        "campus": "Restinga",
        "modalidade": bolsa.get_tipo_display().lower(),
        "projeto_titulo": bolsa.projeto.titulo,
        "coordenador_nome": bolsa.projeto.coordenador_projeto.usuario.nome,
        "edital": f"{bolsa.edital.ano_codigo} - {bolsa.edital.nome}",
        "vigencia": (
            f"{bolsa.data_inicio_vigencia:%d/%m/%Y} a {bolsa.data_fim_vigencia:%d/%m/%Y}"
            if bolsa.data_inicio_vigencia and bolsa.data_fim_vigencia
            else "conforme o edital"
        ),
        "carga_horaria": bolsa.carga_horaria_semanal,
        "responsavel_legal": perfil.nome_responsavel_legal,
    }


def _adicionar_paragrafo(documento, texto, titulo=False, alinhar_inicio=False):
    paragrafo = documento.add_paragraph()
    if titulo:
        paragrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
    elif alinhar_inicio:
        paragrafo.alignment = WD_ALIGN_PARAGRAPH.LEFT
    else:
        paragrafo.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    paragrafo.paragraph_format.space_after = Pt(9)
    linhas = texto.splitlines()
    for indice, linha in enumerate(linhas):
        if indice:
            paragrafo.add_run().add_break()
        trecho = paragrafo.add_run(linha)
        trecho.bold = titulo
    return paragrafo


def _configurar_cabecalho(secao):
    secao.header_distance = Cm(0.5)
    cabecalho = secao.header
    paragrafo_imagem = cabecalho.paragraphs[0]
    paragrafo_imagem.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragrafo_imagem.paragraph_format.space_after = Pt(0)
    paragrafo_imagem.add_run().add_picture(str(BRASAO_REPUBLICA), width=Cm(1.55))

    linhas = [
        "Ministério da Educação",
        "Secretaria de Educação Profissional e Tecnológica",
        "Instituto Federal de Educação, Ciência e Tecnologia do Rio Grande do Sul",
        "Campus Restinga",
    ]
    for linha in linhas:
        paragrafo = cabecalho.add_paragraph()
        paragrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        paragrafo.paragraph_format.space_before = Pt(0)
        paragrafo.paragraph_format.space_after = Pt(0)
        paragrafo.paragraph_format.line_spacing = 1
        trecho = paragrafo.add_run(linha)
        trecho.font.name = "Times New Roman"
        trecho.font.size = Pt(10)


def gerar_docx_termo(vinculo, perfil):
    menor = calcular_idade(perfil.data_nascimento) < 18
    tipo = TipoTermo.MENOR if menor else TipoTermo.MAIOR
    template = "bolsistas/termo_menor.txt" if menor else "bolsistas/termo_maior.txt"
    texto_html = render_to_string(template, contexto_termo(vinculo, perfil)).strip()
    texto = unescape(strip_tags(texto_html.replace("<br/>", "\n")))

    buffer = BytesIO()
    documento = Document()
    secao = documento.sections[0]
    secao.page_width = Cm(21)
    secao.page_height = Cm(29.7)
    secao.top_margin = Cm(4.5)
    secao.bottom_margin = Cm(1.8)
    secao.left_margin = Cm(2)
    secao.right_margin = Cm(2)
    _configurar_cabecalho(secao)
    estilo = documento.styles["Normal"]
    estilo.font.name = "Arial"
    estilo.font.size = Pt(11)
    documento.core_properties.title = "Termo de Compromisso do Bolsista"

    partes = [parte.strip() for parte in texto.split("\n\n") if parte.strip()]
    for indice, parte in enumerate(partes):
        _adicionar_paragrafo(
            documento,
            parte,
            titulo=indice == 0,
            alinhar_inicio=parte.startswith("Projeto:"),
        )

    documento.add_paragraph()
    rotulos = (
        ["Estudante", "Responsável legal", "Coordenador(a) do projeto"]
        if menor
        else ["Estudante", "Coordenador(a) do projeto"]
    )
    tabela = documento.add_table(rows=2, cols=len(rotulos))
    tabela.alignment = WD_TABLE_ALIGNMENT.CENTER
    for indice, rotulo in enumerate(rotulos):
        assinatura = tabela.cell(0, indice)
        assinatura.text = "____________________________"
        assinatura.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.BOTTOM
        assinatura.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        descricao = tabela.cell(1, indice)
        descricao.text = rotulo
        descricao.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER

    documento.save(buffer)
    return tipo, buffer.getvalue()
