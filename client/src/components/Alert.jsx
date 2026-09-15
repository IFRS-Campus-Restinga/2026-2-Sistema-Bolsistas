import './Alert.css'

/**
 * Alerta visual de erro ou sucesso.
 *
 * Uso: <Alert tone="error">Mensagem de erro</Alert>
 */
export function Alert({ tone, children }) {
  const icon = tone === 'error' ? '⚠' : '✓'
  return (
    <div className={`alert alert--${tone}`}>
      <span className="alert__icon">{icon}</span>
      <span>{children}</span>
    </div>
  )
}
