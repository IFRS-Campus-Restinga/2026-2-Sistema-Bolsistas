import './TopHeader.css'

/**
 * Cabeçalho superior com campus + dados do usuário logado.
 *
 * Props:
 *   campus   — nome do campus ("Campus Restinga")
 *   name     — nome do usuário
 *   role     — papel/perfil
 *   initials — iniciais para o avatar
 */
export function TopHeader({ campus, name, role, initials }) {
  return (
    <header className="top-header">
      <div className="top-header__campus">
        <span className="top-header__dot" />
        <span className="top-header__campus-name">{campus}</span>
      </div>

      <div className="top-header__user">
        <div className="top-header__user-info">
          <div className="top-header__user-name">{name}</div>
          <div className="top-header__user-role">{role}</div>
        </div>
        <div className="top-header__avatar">{initials}</div>
      </div>
    </header>
  )
}
