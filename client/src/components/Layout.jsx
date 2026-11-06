import { Sidebar } from './Sidebar'
import { TopHeader } from './TopHeader'

/**
 * Layout principal da aplicação: Sidebar + TopHeader + área de conteúdo.
 *
 * Props:
 *   role       — papel do usuário (exibido na sidebar e header)
 *   menuItems  — itens de menu [{ id, label, icon }]
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
  menuItems,
  active,
  onNav,
  onLogout,
  campus,
  userName,
  initials,
  children,
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        role={role}
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
