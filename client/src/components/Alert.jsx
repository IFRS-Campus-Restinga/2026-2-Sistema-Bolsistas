const ICON_POR_TONE = {
  error: '⚠',
  warning: '⚠',
  success: '✓',
}

/**
 * Alerta visual de erro, aviso ou sucesso.
 *
 * Uso: <Alert tone="warning">Mensagem de aviso</Alert>
 */
const CLASSES_POR_TONE = {
  error: 'border-red-200 bg-red-50 text-red-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
}

export function Alert({ tone, children }) {
  const icon = ICON_POR_TONE[tone] ?? '✓'
  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-base ${CLASSES_POR_TONE[tone] ?? ''}`}
    >
      <span className="mt-0.5 shrink-0 font-bold">{icon}</span>
      <span>{children}</span>
    </div>
  )
}
