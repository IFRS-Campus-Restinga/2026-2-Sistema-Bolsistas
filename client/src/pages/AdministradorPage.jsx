import { useState } from 'react'
import {
  Layout,
  Button,
  PageHeader,
  IconHome,
  IconCalendar,
  IconBriefcase,
  IconUsers,
  IconClipboardList,
} from '../components'
import UsuariosPage from './admin/UsuariosPage'
import MonitoramentoPage from './admin/MonitoramentoPage'
import AuditoriaPage from './admin/AuditoriaPage'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'editais', label: 'Editais', icon: <IconCalendar /> },
  { id: 'projetos', label: 'Projetos', icon: <IconBriefcase /> },
  { id: 'usuarios', label: 'Usuários', icon: <IconUsers /> },
  { id: 'auditoria', label: 'Auditoria', icon: <IconClipboardList /> },
]

export default function AdministradorPage({ me, initials, onVoltarHub }) {
  const [active, setActive] = useState('dashboard')

  return (
    <Layout
      role="Administrador"
      menuItems={menuItems}
      active={active}
      onNav={setActive}
      onLogout={onVoltarHub}
      campus="Campus Restinga"
      userName={me.nome || '(sem nome)'}
      initials={initials}
    >
      {active === 'dashboard' && (
        <>
          <PageHeader
            title="Painel Administrativo"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => (window.location.href = '/showcase')}
              >
                Ver Showcase
              </Button>
            }
          />

          <MonitoramentoPage />
        </>
      )}
      {active === 'usuarios' && <UsuariosPage />}
      {active === 'auditoria' && <AuditoriaPage />}
    </Layout>
  )
}
