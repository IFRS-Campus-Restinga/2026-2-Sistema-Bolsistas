import { IFLogo } from './IFLogo'
import { IconLogOut } from './Icons'
import './Sidebar.css'

/**
 * Barra lateral de navegação.
 *
 * Props:
 *   role       — papel do usuário exibido sob o título ("Administrador", etc.)
 *   menuItems  — [{ id, label, icon }]
 *   active     — id do item ativo
 *   onNav      — callback(id) ao clicar num item
 *   onLogout   — callback ao clicar em "Sair do Sistema"
 */
export function Sidebar({ role, menuItems, active, onNav, onLogout }) {
  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar__brand">
        <IFLogo size={38} />
        <div>
          <div className="sidebar__title">Sistema de Bolsistas</div>
          <div className="sidebar__role">{role}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar__nav">
        <p className="sidebar__section-label">Menu Principal</p>
        <ul className="sidebar__list">
          {menuItems.map((item) => {
            const isActive = active === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNav(item.id)}
                  className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
                >
                  <span className={`sidebar__icon ${isActive ? 'sidebar__icon--active' : ''}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="sidebar__footer">
        <button onClick={onLogout} className="sidebar__logout">
          <IconLogOut />
          Sair do Sistema
        </button>
      </div>
    </aside>
  )
}
