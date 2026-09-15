import './Banner.css'

/**
 * Banner decorativo com gradiente verde (para boas-vindas, CTAs, etc.)
 */
export function Banner({ title, description, action }) {
  return (
    <div className="banner">
      <div className="banner__circle banner__circle--lg" />
      <div className="banner__circle banner__circle--sm" />
      <div className="banner__text">
        <h2 className="banner__title">{title}</h2>
        <p className="banner__description">{description}</p>
      </div>
      {action && <div className="banner__action">{action}</div>}
    </div>
  )
}
