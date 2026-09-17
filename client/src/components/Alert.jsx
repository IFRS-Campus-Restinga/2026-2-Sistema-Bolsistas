import './Alert.css'

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
export function Alert({ tone, children }) {
  const icon = ICON_POR_TONE[tone] ?? '✓'
  return (
    <div className={`alert alert--${tone}`}>
      <span className="alert__icon">{icon}</span>
      <span>{children}</span>
    </div>
  )
}
