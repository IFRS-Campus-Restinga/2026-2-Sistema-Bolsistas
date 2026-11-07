import { useEffect, useState } from 'react'
import { monitoramentoFetch } from '../api'
import { Sidebar } from './Sidebar'
import { TopHeader } from './TopHeader'

/**
 * Pendências por tab da sidebar ({ id_da_tab: quantidade }). Recalcula a cada troca de
 * tab, para o contador acompanhar o que o usuário acabou de resolver.
 */
function useContadoresMenu(active) {
  const [contadores, setContadores] = useState({})

  useEffect(() => {
    let ativo = true
    monitoramentoFetch('/contadores-menu/')
      .then((response) => (response.ok ? response.json() : null))
      .then((dados) => {
        if (ativo && dados) setContadores(dados)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [active])

  return contadores
}

/**
 * Layout principal da aplicação: Sidebar + TopHeader + área de conteúdo.
 *
 * Props:
 *   role       — papel do usuário (exibido na sidebar e header)
 *   sections   — seções do menu [{ title?, items: [{ id, label, icon }] }]
 *   menuItems  — lista plana de itens, alternativa a `sections`
 *   active     — id do item ativo
 *   onNav      — callback de navegação
 *   onLogout   — callback de logout
 *   campus     — nome do campus
 *   userName   — nome do usuário
 *   initials   — iniciais para o avatar
 *   children   — conteúdo da página
 */
export function Layout({
  role,
  sections,
  menuItems,
  active,
  onNav,
  onLogout,
  campus,
  userName,
  initials,
  children,
}) {
  const contadores = useContadoresMenu(active)
  const secoesComContadores = sections?.map((secao) => ({
    ...secao,
    items: secao.items.map((item) => ({ ...item, count: contadores[item.id] })),
  }))

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        role={role}
        sections={secoesComContadores}
        menuItems={menuItems}
        active={active}
        onNav={onNav}
        onLogout={onLogout}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopHeader campus={campus} name={userName} role={role} initials={initials} />
        <main className="flex-1 overflow-y-auto bg-fundo p-8">{children}</main>
      </div>
    </div>
  )
}
