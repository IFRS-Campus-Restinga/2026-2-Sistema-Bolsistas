// Rótulo e tom de cada status do sistema, usados pelo StatusPill (components/Badge.jsx).

export const STATUS = {
  // Edital
  RASCUNHO: ['Rascunho', 'neutral'],
  PUBLICADO: ['Em vigor', 'success'],
  EM_VIGOR: ['Em vigor', 'success'],
  ENCERRADO: ['Encerrado', 'neutral'],
  ARQUIVADO: ['Encerrado', 'neutral'],
  // Projeto / vínculo
  ATIVO: ['Ativo', 'success'],
  DESLIGADO: ['Desligado', 'neutral'],
  // Bolsa
  SOLICITADA: ['Solicitada', 'warning'],
  APROVADA: ['Aberta', 'success'],
  REJEITADA: ['Rejeitada', 'danger'],
  ABERTA: ['Aberta', 'success'],
  EM_SELECAO: ['Em seleção', 'info'],
  PREENCHIDA: ['Preenchida', 'info'],
  ENCERRADA: ['Encerrada', 'neutral'],
  CANCELADA: ['Cancelada', 'neutral'],
  // Inscrição / recurso / pagamento
  PENDENTE: ['Pendente', 'warning'],
  HOMOLOGADA: ['Homologada', 'success'],
  INDEFERIDA: ['Indeferida', 'danger'],
  DEFERIDO: ['Deferido', 'success'],
  INDEFERIDO: ['Indeferido', 'danger'],
  EM_ANALISE: ['Em análise', 'info'],
  AUTORIZADO: ['Autorizado', 'success'],
  APROVADO: ['Aprovado', 'success'],
  NEGADO: ['Negado', 'danger'],
  REPROVADO: ['Reprovado', 'danger'],
  REJEITADO: ['Rejeitado', 'danger'],
  RECUSADO: ['Recusado', 'neutral'],
  EXPIRADO: ['Expirado', 'neutral'],
  // Classificação e indicação
  TITULAR: ['Titular', 'success'],
  SUPLENTE: ['Suplente', 'info'],
  DESCLASSIFICADO: ['Desclassificado', 'neutral'],
  NOTAS_PENDENTES: ['Notas pendentes', 'neutral'],
  INDICADO: ['Indicado(a)', 'success'],
  NAO_ASSUMIU: ['Não assumiu', 'neutral'],
  RESULTADO_PUBLICADO: ['Resultado publicado', 'success'],
  // Frequência
  REGISTRADA: ['Cumprida', 'success'],
  NAO_REGISTRADA: ['Não cumprida', 'danger'],
  NAO_INFORMADO: ['Aguardando lançamento', 'warning'],
  // Relatório / convite
  NAO_SOLICITADO: ['Não solicitado', 'neutral'],
  SOLICITADO: ['Solicitado', 'warning'],
  ENVIADO: ['Enviado', 'info'],
  AGUARDANDO_AVALIACAO: ['Em avaliação', 'info'],
  EM_PREENCHIMENTO: ['Em preenchimento', 'info'],
  // Ações da auditoria (o rótulo vem da API), agrupadas por significado
  APROVACAO: [null, 'success'],
  PUBLICACAO: [null, 'success'],
  ATIVACAO: [null, 'success'],
  REJEICAO: [null, 'danger'],
  CANCELAMENTO: [null, 'danger'],
  EXCLUSAO: [null, 'danger'],
  DESATIVACAO: [null, 'danger'],
  CRIACAO: [null, 'info'],
  VINCULO: [null, 'info'],
  ATUALIZACAO: [null, 'neutral'],
  ENCERRAMENTO: [null, 'neutral'],
  DESISTENCIA: [null, 'warning'],
}

/** Rótulo de exibição de um status (o próprio código quando não é conhecido). */
export function statusLabel(status) {
  return STATUS[status]?.[0] ?? status
}
