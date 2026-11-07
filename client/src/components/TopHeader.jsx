import { useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconChevronRight, IconLogOut, IconUser } from './Icons'

/**
 * Círculo com as iniciais do usuário.
 */
export function Avatar({ initials, size = 28 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-gray-900 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  )
}

/**
 * Menu do avatar: nome, papel, atalhos pessoais (ex.: Dados bancários) e Voltar ao HUB.
 * Cada item: { id, label, icon?, hint?, onClick }.
 */
function MenuDaConta({ name, role, initials, items, onLogout }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!aberto) return undefined
    function aoClicarFora(evento) {
      if (!ref.current?.contains(evento.target)) setAberto(false)
    }
    function aoTeclar(evento) {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  const ITEM =
    'flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3 py-2 text-left text-sm leading-[normal] text-gray-700 hover:bg-gray-50'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={`flex cursor-pointer items-center gap-2 rounded-controle border-0 py-1 pr-1.5 pl-1 leading-[normal] transition-colors ${aberto ? 'bg-gray-100' : 'bg-transparent hover:bg-gray-100'}`}
      >
        <Avatar initials={initials} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium text-gray-900">{name}</span>
          <span className="block text-2xs text-gray-500">{role}</span>
        </span>
        <IconChevronDown size={14} className="text-gray-400" />
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute top-11 right-0 z-40 w-64 animate-aparecer overflow-hidden rounded-card border border-gray-200 bg-white py-1 shadow-pop"
        >
          <div className="border-b border-gray-100 px-3 py-2.5">
            <div className="text-sm font-medium text-gray-900">{name}</div>
            <div className="text-xs text-gray-500">{role}</div>
          </div>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                item.onClick()
                setAberto(false)
              }}
              className={ITEM}
            >
              <span className="text-gray-400">{item.icon ?? <IconUser />}</span>
              <span className="flex-1">{item.label}</span>
              {item.hint}
            </button>
          ))}
          {onLogout && (
            <button
              type="button"
              role="menuitem"
              onClick={onLogout}
              className={`${ITEM} border-t border-solid border-gray-100`}
            >
              <span className="text-gray-400">
                <IconLogOut />
              </span>
              Voltar ao HUB
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Cabeçalho superior: breadcrumb da tab atual e menu do avatar.
 *
 * Props:
 *   campus       — nome do campus ("Campus Restinga")
 *   section      — título da seção da sidebar da tab atual (opcional)
 *   page         — nome da tab atual
 *   name, role, initials — dados do usuário logado
 *   accountItems — atalhos do menu do avatar [{ id, label, icon?, hint?, onClick }]
 *   onLogout     — "Voltar ao HUB" no menu do avatar
 */
export function TopHeader({
  campus,
  section,
  page,
  name,
  role,
  initials,
  accountItems = [],
  onLogout,
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white/80 px-6 backdrop-blur">
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="text-gray-400">{campus}</span>
        {section && (
          <>
            <IconChevronRight size={14} className="text-gray-300" />
            <span className="text-gray-400">{section}</span>
          </>
        )}
        {page && (
          <>
            <IconChevronRight size={14} className="text-gray-300" />
            <span className="truncate font-medium text-gray-900">{page}</span>
          </>
        )}
      </div>
      <MenuDaConta
        name={name}
        role={role}
        initials={initials}
        items={accountItems}
        onLogout={onLogout}
      />
    </header>
  )
}
