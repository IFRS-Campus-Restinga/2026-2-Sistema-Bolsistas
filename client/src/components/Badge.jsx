import './Badge.css';

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
  REJEITADA: 'badge--red',
  ABERTA: 'badge--green',
  EM_SELECAO: 'badge--blue',
  PREENCHIDA: 'badge--green',
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
};

const STATUS_LABEL = {
  RASCUNHO: 'Rascunho',
  PUBLICADO: 'Publicado',
  ENCERRADO: 'Encerrado',
  ATIVO: 'Ativo',
  DESLIGADO: 'Desligado',
  SOLICITADA: 'Solicitada',
  REJEITADA: 'Rejeitada',
  ABERTA: 'Aberta',
  EM_SELECAO: 'Em Seleção',
  PREENCHIDA: 'Preenchida',
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
};

export function Badge({ status }) {
  if (!status) {
    return <span className="badge badge--gray">—</span>;
  }
  const cls = STATUS_STYLE[status] ?? 'badge--gray';
  const label = STATUS_LABEL[status] ?? status;
  return <span className={`badge ${cls}`}>{label}</span>;
}
