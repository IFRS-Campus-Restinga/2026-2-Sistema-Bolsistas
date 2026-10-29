import { IFLogo } from './IFLogo'
import { IconLogOut } from './Icons'
import { TrocaPerfilDev } from './TrocaPerfilDev'

const BOTAO =
  'flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 px-3 py-2.5 text-base leading-[normal] transition-all duration-150 ease-[ease]'
const ITEM = `${BOTAO} text-left hover:bg-gray-50 hover:text-gray-800`
const ITEM_NORMAL = `${ITEM} bg-transparent font-medium text-gray-500`
const ITEM_ATIVO = `${ITEM} border-l-3 border-l-if-green bg-green-50 font-semibold text-green-800`

/**
 * Barra lateral de navegação.
 *
 * Props:
 *   menuItems  — [{ id, label, icon }]
 *   active     — id do item ativo
 *   onNav      — callback(id) ao clicar num item
 *   onLogout   — callback ao clicar em "Sair do Sistema"
 */
export function Sidebar({ menuItems, active, onNav, onLogout }) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-[#f0f0f0] bg-white">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-[#f4f4f4] p-5">
        <IFLogo size={38} />
        <div>
          <div className="text-base leading-[1.3] font-bold text-gray-900">
            Sistema de Bolsistas
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pt-5">
        <p className="mb-3 px-3 text-[9px] font-bold tracking-[0.12em] text-gray-300 uppercase select-none">
          Menu Principal
        </p>
        <ul className="flex list-none flex-col gap-0.5">
          {menuItems.map((item) => {
            const isActive = active === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNav(item.id)}
                  className={isActive ? ITEM_ATIVO : ITEM_NORMAL}
                >
                  <span className={`shrink-0 ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
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
      <div className="border-t border-[#f4f4f4] p-3 pb-5">
        <TrocaPerfilDev />
        <button
          onClick={onLogout}
          className={`${BOTAO} bg-transparent font-medium text-red-400 hover:bg-red-50 hover:text-red-600`}
        >
          <IconLogOut />
          Voltar ao HUB
        </button>
      </div>
    </aside>
  )
}
