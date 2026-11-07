import { IconAlertTriangle, IconCheckCircle, IconInfo, IconXCircle } from './Icons'

const ESTILOS = {
  error: { classes: 'border-red-200 bg-red-50 text-red-800', icone: <IconXCircle size={16} /> },
  success: {
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icone: <IconCheckCircle size={16} />,
  },
  info: { classes: 'border-blue-200 bg-blue-50 text-blue-800', icone: <IconInfo size={16} /> },
  warning: {
    classes: 'border-amber-200 bg-amber-50 text-amber-800',
    icone: <IconAlertTriangle size={16} />,
  },
}

/**
 * Alerta de erro, sucesso, informação ou aviso, com título opcional.
 *
 * Uso: <Alert tone="warning" title="Resolva as pendências">Mensagem</Alert>
 */
export function Alert({ tone, title, children }) {
  const estilo = ESTILOS[tone] ?? ESTILOS.info
  return (
    <div
      className={`mb-4 flex items-start gap-2.5 rounded-controle border px-3.5 py-2.5 text-sm ${estilo.classes}`}
    >
      <span className="mt-px shrink-0">{estilo.icone}</span>
      <div className="min-w-0">
        {title && <span className="block font-medium">{title}</span>}
        {children}
      </div>
    </div>
  )
}
