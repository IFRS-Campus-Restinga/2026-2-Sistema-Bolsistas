import { useEffect, useState } from 'react'
import { monitoramentoFetch } from '../api'
import { Sidebar } from './Sidebar'
import { SinoNotificacoes } from './SinoNotificacoes'
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
 *   accountItems — atalhos do menu do avatar [{ id, label, icon?, hint?, onClick }]
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
  accountItems = [],
  children,
}) {
  const contadores = useContadoresMenu(active)
  const secoesComContadores = sections?.map((secao) => ({
    ...secao,
    items: secao.items.map((item) => ({ ...item, count: contadores[item.id] })),
  }))

  // Breadcrumb: seção da sidebar e nome da tab atual (ou do atalho do avatar).
  const grupos = sections ?? [{ items: menuItems ?? [] }]
  const secaoAtual = grupos.find((secao) => secao.items.some((item) => item.id === active))
  const pagina =
    secaoAtual?.items.find((item) => item.id === active)?.label ??
    accountItems.find((item) => item.id === active)?.label

  // O destino da notificação é o id de uma tab da sidebar ou de um atalho do avatar.
  function abrirDestino(destino) {
    if (grupos.some((secao) => secao.items.some((item) => item.id === destino))) {
      onNav(destino)
      return
    }
    accountItems.find((item) => item.id === destino)?.onClick()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-fundo">
      <Sidebar
        role={role}
        sections={secoesComContadores}
        menuItems={menuItems}
        active={active}
        onNav={onNav}
        onLogout={onLogout}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopHeader
          campus={campus}
          section={secaoAtual?.title}
          page={pagina}
          name={userName}
          role={role}
          initials={initials}
          accountItems={accountItems}
          onLogout={onLogout}
          acoes={<SinoNotificacoes onAbrirDestino={abrirDestino} />}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px] px-8 py-7">{children}</div>
        </main>
      </div>
    </div>
  )
}
