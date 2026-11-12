"""Comprovante de inscrição (US91): os mesmos dados na tela e no PDF para download."""

from io import BytesIO

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .models import StatusInscricao

# Como a situação aparece no comprovante; o que não estiver aqui usa o rótulo do status.
SITUACAO_NO_COMPROVANTE = {StatusInscricao.PENDENTE: "Aguardando homologação"}

RODAPE = "Documento gerado eletronicamente pelo Sistema de Bolsistas."


def protocolo_da_inscricao(inscricao):
    """INS-AAAAMMDD-NNN: data de envio e número da inscrição; vazio enquanto é rascunho."""
    if not inscricao.data_envio:
        return ""
    enviada = timezone.localtime(inscricao.data_envio)
    return f"INS-{enviada:%Y%m%d}-{inscricao.pk:03d}"


def dados_do_comprovante(inscricao):
    aluno = inscricao.aluno
    perfil = getattr(aluno, "perfil_aluno", None)
    bolsa = inscricao.bolsa
    enviada = timezone.localtime(inscricao.data_envio) if inscricao.data_envio else None
    return {
        "titulo": "Comprovante de inscrição",
        "protocolo": protocolo_da_inscricao(inscricao),
        "emitido_em": timezone.localdate(),
        "linhas": [
            {"rotulo": "Candidato(a)", "valor": aluno.nome or aluno.username},
            {"rotulo": "Matrícula", "valor": (perfil.matricula if perfil else "") or "—"},
            {"rotulo": "Bolsa", "valor": f"{bolsa.modalidade} · {bolsa.carga_horaria_semanal}h"},
            {"rotulo": "Projeto", "valor": bolsa.projeto.titulo},
            {"rotulo": "Edital", "valor": f"{bolsa.edital.ano_codigo} · {bolsa.edital.nome}"},
            {"rotulo": "Enviada em", "valor": f"{enviada:%d/%m/%Y às %H:%M}" if enviada else "—"},
        ],
        "situacao": {
            "status": inscricao.status,
            "rotulo": SITUACAO_NO_COMPROVANTE.get(inscricao.status, inscricao.get_status_display()),
        },
        "documentos": [
            f"{documento.get_tipo_display()} — {documento.nome_original or 'arquivo'}"
            for documento in inscricao.documentos.all()
        ],
        "rodape": RODAPE,
    }


# Cores do design system (zinc e o verde IF).
CINZA_TEXTO = colors.HexColor("#18181b")
CINZA_SUAVE = colors.HexColor("#71717a")
CINZA_BORDA = colors.HexColor("#e4e4e7")
CINZA_FUNDO = colors.HexColor("#fafafa")
VERDE = colors.HexColor("#2f9e41")
VERMELHO = colors.HexColor("#cd191e")

# Marca do IF (mesma grade do IFLogo do frontend): círculo e quadrados em (coluna, linha).
QUADRADOS_DA_MARCA = [(1, 0), (2, 0), (0, 1), (1, 1), (0, 2), (1, 2), (2, 2), (0, 3), (1, 3)]


def desenhar_marca_if(pdf, x, y_topo, altura):
    """Grade 34x46 do IFLogo, escalada para a altura pedida, a partir do canto superior."""
    escala = altura / 46
    pdf.setFillColor(VERMELHO)
    pdf.circle(x + 5 * escala, y_topo - 5 * escala, 5.5 * escala, fill=1, stroke=0)
    pdf.setFillColor(VERDE)
    for coluna, linha in QUADRADOS_DA_MARCA:
        pdf.roundRect(
            x + coluna * 12 * escala,
            y_topo - (linha * 12 + 10) * escala,
            10 * escala,
            10 * escala,
            1 * escala,
            fill=1,
            stroke=0,
        )


def pdf_do_comprovante(inscricao):
    """PDF de uma página no layout do comprovante da tela."""
    dados = dados_do_comprovante(inscricao)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle(f"{dados['titulo']} {dados['protocolo']}")
    largura, altura = A4
    margem = 20 * mm
    caixa_largura = largura - 2 * margem
    topo = altura - margem

    # Cabeçalho: título, instituição e protocolo.
    pdf.setFillColor(CINZA_FUNDO)
    pdf.setStrokeColor(CINZA_BORDA)
    pdf.rect(margem, topo - 22 * mm, caixa_largura, 22 * mm, fill=1, stroke=1)
    desenhar_marca_if(pdf, margem + 5 * mm, topo - 4 * mm, 14 * mm)
    pdf.setFillColor(CINZA_TEXTO)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(margem + 18 * mm, topo - 10 * mm, dados["titulo"])
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(CINZA_SUAVE)
    pdf.drawString(margem + 18 * mm, topo - 15 * mm, "IFRS · Campus Restinga")
    pdf.drawRightString(margem + caixa_largura - 5 * mm, topo - 10 * mm, "Protocolo")
    pdf.setFont("Courier-Bold", 12)
    pdf.setFillColor(CINZA_TEXTO)
    pdf.drawRightString(margem + caixa_largura - 5 * mm, topo - 16 * mm, dados["protocolo"])

    # Dados em duas colunas, como na tela.
    linhas = [*dados["linhas"], {"rotulo": "Situação", "valor": dados["situacao"]["rotulo"]}]
    y = topo - 32 * mm
    coluna = caixa_largura / 2
    for indice, linha in enumerate(linhas):
        x = margem + 5 * mm + (indice % 2) * coluna
        if indice and indice % 2 == 0:
            y -= 14 * mm
        pdf.setFont("Helvetica", 8.5)
        pdf.setFillColor(CINZA_SUAVE)
        pdf.drawString(x, y, linha["rotulo"])
        pdf.setFont("Helvetica-Bold", 10)
        pdf.setFillColor(CINZA_TEXTO)
        valor = str(linha["valor"])
        limite = 46
        pdf.drawString(x, y - 5 * mm, valor if len(valor) <= limite else f"{valor[: limite - 1]}…")

    # Documentos anexados.
    y -= 16 * mm
    pdf.setStrokeColor(CINZA_BORDA)
    pdf.setDash(2, 2)
    pdf.line(margem, y, margem + caixa_largura, y)
    pdf.setDash()
    y -= 7 * mm
    pdf.setFont("Helvetica", 8.5)
    pdf.setFillColor(CINZA_SUAVE)
    pdf.drawString(margem + 5 * mm, y, "Documentos anexados")
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(CINZA_TEXTO)
    for documento in dados["documentos"] or ["Nenhum documento anexado."]:
        y -= 6 * mm
        pdf.drawString(margem + 5 * mm, y, f"•  {documento}" if dados["documentos"] else documento)

    # Rodapé com a data de emissão.
    y -= 12 * mm
    pdf.setStrokeColor(CINZA_BORDA)
    pdf.line(margem, y, margem + caixa_largura, y)
    pdf.setFont("Helvetica", 8.5)
    pdf.setFillColor(CINZA_SUAVE)
    pdf.drawString(margem + 5 * mm, y - 6 * mm, dados["rodape"])
    pdf.drawRightString(
        margem + caixa_largura - 5 * mm, y - 6 * mm, f"Emitido em {dados['emitido_em']:%d/%m/%Y}"
    )
    pdf.setStrokeColor(CINZA_BORDA)
    pdf.rect(margem, y - 10 * mm, caixa_largura, topo - (y - 10 * mm), fill=0, stroke=1)

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
