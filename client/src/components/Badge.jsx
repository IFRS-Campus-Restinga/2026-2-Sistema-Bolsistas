/**
 * StatusPill: um único componente de status para todos os enums do sistema, como no
 * protótipo. Cinco tons semânticos e rótulos unificados para enums redundantes:
 *   Bolsa APROVADA → "Aberta" (APROVADA não é usado pelo backend)
 *   Edital ENCERRADO/ARQUIVADO → "Encerrado" (arquivado vira filtro)
 *   Frequência REGISTRADA/NAO_REGISTRADA/NAO_INFORMADO →
 *     "Cumprida" / "Não cumprida" / "Aguardando lançamento"
 *
 * Uso: <StatusPill status="ATIVO" />, <StatusPill label="Pendente" tone="warning" size="sm" />
 * `Badge` é o mesmo componente com o nome antigo.
 */

import { STATUS } from '../utils/status'

const CLASSES_POR_TOM = {
  neutral: { pill: 'bg-gray-100 text-gray-600 ring-gray-200', dot: 'bg-gray-400' },
  info: { pill: 'bg-blue-50 text-blue-700 ring-blue-200/70', dot: 'bg-blue-500' },
  success: {
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
    dot: 'bg-emerald-500',
  },
  warning: { pill: 'bg-amber-50 text-amber-700 ring-amber-200/70', dot: 'bg-amber-500' },
  danger: { pill: 'bg-red-50 text-red-700 ring-red-200/70', dot: 'bg-red-500' },
}

export function StatusPill({ status, label, tone, size = 'md' }) {
  if (!status && !label) return <span className="text-gray-300">—</span>

  const [rotuloDoMapa, tomDoMapa] = STATUS[status] ?? [status, 'neutral']
  const classes = CLASSES_POR_TOM[tone ?? tomDoMapa] ?? CLASSES_POR_TOM.neutral
  const tamanho = size === 'sm' ? 'px-1.5 py-px text-2xs' : 'px-2 py-0.5 text-xs'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset ${classes.pill} ${tamanho}`}
    >
      <span className={`size-1.5 rounded-full ${classes.dot}`} />
      {label ?? rotuloDoMapa ?? status}
    </span>
  )
}

/** Nome antigo do StatusPill, mantido para as telas existentes. */
export function Badge(props) {
  return <StatusPill {...props} />
}
