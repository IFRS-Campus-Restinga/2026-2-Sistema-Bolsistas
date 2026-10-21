/**
 * Badge de status — aplica estilo automático pelo nome do status.
 *
 * Uso: <Badge status="ATIVO" />
 */

const TOM_POR_STATUS = {
  RASCUNHO: 'gray',
  PUBLICADO: 'green',
  ENCERRADO: 'gray',
  ATIVO: 'green',
  DESLIGADO: 'red',
  SOLICITADA: 'yellow',
  APROVADA: 'green',
  REJEITADA: 'red',
  ABERTA: 'green',
  EM_SELECAO: 'blue',
  PREENCHIDA: 'green',
  ENCERRADA: 'gray',
  CANCELADA: 'red',
  PENDENTE: 'yellow',
  HOMOLOGADA: 'blue',
  INDEFERIDA: 'red',
  DEFERIDO: 'green',
  INDEFERIDO: 'red',
  TITULAR: 'green',
  SUPLENTE: 'yellow',
  DESCLASSIFICADO: 'red',
  EM_ANALISE: 'blue',
  EXPIRADO: 'gray',
  EM_VIGOR: 'green',
  ARQUIVADO: 'gray',
  EM_PREENCHIMENTO: 'blue',
  ENVIADO: 'yellow',
  APROVADO: 'green',
  REJEITADO: 'red',
  RECUSADO: 'red',
  NOTAS_PENDENTES: 'gray',
  INDICADO: 'green',
  NAO_ASSUMIU: 'gray',
  RESULTADO_PUBLICADO: 'green',
  // Ações da auditoria, agrupadas por significado
  APROVACAO: 'green',
  PUBLICACAO: 'green',
  ATIVACAO: 'green',
  REJEICAO: 'red',
  CANCELAMENTO: 'red',
  EXCLUSAO: 'red',
  DESATIVACAO: 'red',
  CRIACAO: 'blue',
  ATUALIZACAO: 'gray',
  ENCERRAMENTO: 'gray',
  DESISTENCIA: 'yellow',
  VINCULO: 'purple',
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

const CLASSES_POR_TOM = {
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  blue: 'bg-blue-100 text-blue-700',
  gray: 'bg-gray-100 text-gray-600',
  purple: 'bg-purple-100 text-purple-700',
}

const BASE = 'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

export function Badge({ status, label: labelInformado }) {
  if (!status) {
    return <span className={`${BASE} ${CLASSES_POR_TOM.gray}`}>—</span>
  }
  const tom = TOM_POR_STATUS[status] ?? 'gray'
  const label = labelInformado ?? STATUS_LABEL[status] ?? status
  return <span className={`${BASE} ${CLASSES_POR_TOM[tom]}`}>{label}</span>
}
