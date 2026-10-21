import './Badge.css'

/**
 * Badge de status — aplica estilo automático pelo nome do status.
 *
 * Uso: <Badge status="ATIVO" />
 */

const STATUS_STYLE = {
  RASCUNHO: 'badge--gray',
  PUBLICADO: 'badge--green',
  ENCERRADO: 'badge--gray',
  ATIVO: 'badge--green',
  DESLIGADO: 'badge--red',
  SOLICITADA: 'badge--yellow',
  APROVADA: 'badge--green',
  REJEITADA: 'badge--red',
  ABERTA: 'badge--green',
  EM_SELECAO: 'badge--blue',
  PREENCHIDA: 'badge--green',
  ENCERRADA: 'badge--gray',
  CANCELADA: 'badge--red',
  PENDENTE: 'badge--yellow',
  HOMOLOGADA: 'badge--blue',
  INDEFERIDA: 'badge--red',
  DEFERIDO: 'badge--green',
  INDEFERIDO: 'badge--red',
  TITULAR: 'badge--green',
  SUPLENTE: 'badge--yellow',
  DESCLASSIFICADO: 'badge--red',
  EM_ANALISE: 'badge--blue',
  EXPIRADO: 'badge--gray',
  EM_VIGOR: 'badge--green',
  ARQUIVADO: 'badge--gray',
  EM_PREENCHIMENTO: 'badge--blue',
  ENVIADO: 'badge--yellow',
  APROVADO: 'badge--green',
  REJEITADO: 'badge--red',
  RECUSADO: 'badge--red',
  NOTAS_PENDENTES: 'badge--gray',
  INDICADO: 'badge--green',
  NAO_ASSUMIU: 'badge--gray',
  RESULTADO_PUBLICADO: 'badge--green',
  // Ações da auditoria, agrupadas por significado
  APROVACAO: 'badge--green',
  PUBLICACAO: 'badge--green',
  ATIVACAO: 'badge--green',
  REJEICAO: 'badge--red',
  CANCELAMENTO: 'badge--red',
  EXCLUSAO: 'badge--red',
  DESATIVACAO: 'badge--red',
  CRIACAO: 'badge--blue',
  ATUALIZACAO: 'badge--gray',
  ENCERRAMENTO: 'badge--gray',
  DESISTENCIA: 'badge--yellow',
  VINCULO: 'badge--purple',
}

const STATUS_LABEL = {
  RASCUNHO: 'Rascunho',
  PUBLICADO: 'Publicado',
  ENCERRADO: 'Encerrado',
  ATIVO: 'Ativo',
  DESLIGADO: 'Desligado',
  SOLICITADA: 'Solicitada',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
  ABERTA: 'Aberta',
  EM_SELECAO: 'Em Seleção',
  PREENCHIDA: 'Preenchida',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
  PENDENTE: 'Pendente',
  HOMOLOGADA: 'Homologada',
  INDEFERIDA: 'Indeferida',
  DEFERIDO: 'Deferido',
  INDEFERIDO: 'Indeferido',
  TITULAR: 'Titular',
  SUPLENTE: 'Suplente',
  DESCLASSIFICADO: 'Desclassificado',
  EM_ANALISE: 'Em Análise',
  EXPIRADO: 'Expirado',
  EM_VIGOR: 'Em vigor',
  ARQUIVADO: 'Arquivado',
  EM_PREENCHIMENTO: 'Em Preenchimento',
  ENVIADO: 'Documentos Enviados',
  APROVADO: 'Aprovado',
  REJEITADO: 'Rejeitado',
  RECUSADO: 'Recusado',
  NOTAS_PENDENTES: 'Notas pendentes',
  INDICADO: 'Indicado(a)',
  NAO_ASSUMIU: 'Não assumiu',
  RESULTADO_PUBLICADO: 'Resultado publicado',
}

export function Badge({ status, label: labelInformado }) {
  if (!status) {
    return <span className="badge badge--gray">—</span>
  }
  const cls = STATUS_STYLE[status] ?? 'badge--gray'
  const label = labelInformado ?? STATUS_LABEL[status] ?? status
  return <span className={`badge ${cls}`}>{label}</span>
}
