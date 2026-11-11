// Itens de conferência de cada tipo de documento, como no protótipo.
const CHECKLIST_POR_TIPO = {
  HISTORICO_ESCOLAR: [
    'Documento legível',
    'Nome e matrícula conferem',
    'Período atende ao pré-requisito',
  ],
  COMPROVANTE_MATRICULA: [
    'Documento legível',
    'Matrícula ativa no semestre',
    'Emitido há menos de 30 dias',
  ],
  ADICIONAL: ['Documento legível', 'Relevante para a bolsa'],
}

/**
 * Converte os documentos da API (inscrição ou convite) para o DocumentViewer e o DocList.
 * `dono` é o nome do aluno, mostrado no painel de revisão.
 */
export function documentosParaViewer(documentos, dono) {
  return documentos.map((documento) => ({
    id: documento.id,
    label: documento.tipo_display,
    fileName: documento.nome_original || documento.tipo_display,
    url: documento.arquivo,
    owner: dono,
    decision: documento.decisao,
    decisionLabel: documento.decisao_display,
    motivoRecusa: documento.motivo_recusa,
    checklist: CHECKLIST_POR_TIPO[documento.tipo],
  }))
}
