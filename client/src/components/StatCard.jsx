import './StatCard.css';

/**
 * Card de estatística para dashboards.
 *
 * Props:
 *   label     — rótulo superior ("EDITAIS ATIVOS")
 *   value     — valor numérico ou texto
 *   icon      — ReactNode do ícone
 *   color     — "green" | "purple" | "blue" | "orange" | "red"
 *   clickable — se mostra indicação de clicável no hover
 */
export function StatCard({ label, value, icon, color = 'green', clickable = false }) {
  return (
    <div className={`stat-card stat-card--${color} ${clickable ? 'stat-card--clickable' : ''}`}>
      <div className="stat-card__content">
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">{value}</p>
      </div>
      <div className={`stat-card__icon stat-card__icon--${color}`}>{icon}</div>
      {clickable && <span className="stat-card__link">Ir para →</span>}
    </div>
  );
}
