import { IFLogo } from './IFLogo'
import { IconLogOut } from './Icons'
import { TrocaPerfilDev } from './TrocaPerfilDev'

const ITEM =
  'group flex w-full cursor-pointer items-center gap-2.5 rounded-controle border-0 px-2.5 py-[7px] text-left text-sm leading-[normal] transition-colors'
const ITEM_NORMAL = `${ITEM} bg-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900`
const ITEM_ATIVO = `${ITEM} bg-gray-100 font-medium text-gray-900`

/**
 * Barra lateral de navegação, com os itens agrupados em seções.
 *
 * Props:
 *   role      — papel exibido abaixo do nome do sistema
 *   sections  — [{ title?, items: [{ id, label, icon, count? }] }]; seção sem título fica no topo
 *               `count` mostra um contador de pendências ao lado do item
 *   menuItems — lista plana [{ id, label, icon }], alternativa a `sections`
 *   active    — id do item ativo
 *   onNav     — callback(id) ao clicar num item
 *   onLogout  — callback ao clicar em "Voltar ao HUB"
 */
export function Sidebar({ role, sections, menuItems = [], active, onNav, onLogout }) {
  const grupos = sections ?? [{ items: menuItems }]

  return (
    <aside className="flex h-full w-62 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center gap-2.5 border-b border-gray-100 px-4">
        <IFLogo size={26} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold text-gray-900">Sistema de Bolsistas</div>
          {role && <div className="truncate text-2xs text-gray-500">{role}</div>}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {grupos.map((grupo, indice) => (
          <div key={grupo.title ?? indice} className={indice > 0 ? 'mt-5' : ''}>
            {grupo.title && (
              <p className="mb-1 px-2.5 text-2xs font-medium text-gray-400 select-none">
                {grupo.title}
              </p>
            )}
            <ul className="flex list-none flex-col gap-px">
              {grupo.items.map((item) => {
                const ativo = active === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onNav(item.id)}
                      aria-current={ativo ? 'page' : undefined}
                      className={ativo ? ITEM_ATIVO : ITEM_NORMAL}
                    >
                      <span
                        className={`shrink-0 ${ativo ? 'text-brand' : 'text-gray-400 group-hover:text-gray-600'}`}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {!!item.count && (
                        <span
                          className={`rounded-full px-1.5 text-2xs font-semibold tabular-nums ${ativo ? 'bg-white text-gray-700' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {item.count}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-2.5">
        <TrocaPerfilDev />
        <button type="button" onClick={onLogout} className={ITEM_NORMAL}>
          <span className="shrink-0 text-gray-400 group-hover:text-gray-600">
            <IconLogOut />
          </span>
          Voltar ao HUB
        </button>
      </div>
    </aside>
  )
}
