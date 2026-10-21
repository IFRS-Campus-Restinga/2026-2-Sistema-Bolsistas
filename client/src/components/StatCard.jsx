import './StatCard.css'

/**
 * Card de estatística para dashboards.
 *
 * Props:
 *   label     — rótulo superior ("EDITAIS ATIVOS")
 *   value     — valor numérico ou texto
 *   detail    — linha de contexto abaixo do valor ("de 10 vagas"), opcional
 *   icon      — ReactNode do ícone
 *   color     — "green" | "purple" | "blue" | "orange" | "red"
 *   clickable — se mostra indicação de clicável no hover
 */
export function StatCard({
  label,
  value,
  detail,
  icon,
  color = 'green',
  clickable = false,
  onClick,
}) {
  const clicavel = clickable || !!onClick

  return (
    <div
      className={`stat-card stat-card--${color} ${clicavel ? 'stat-card--clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (evento) => {
              if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <div className="stat-card__content">
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">{value}</p>
        {detail && <p className="stat-card__detail">{detail}</p>}
      </div>
      <div className={`stat-card__icon stat-card__icon--${color}`}>{icon}</div>
      {clicavel && <span className="stat-card__link">Ir para →</span>}
    </div>
  )
}
