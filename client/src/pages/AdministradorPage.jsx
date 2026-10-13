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
import UsuariosPage from './UsuariosPage'
import MonitoramentoPage from './MonitoramentoPage'
import AuditoriaPage from './AuditoriaPage'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'editais', label: 'Editais', icon: <IconCalendar /> },
  { id: 'projetos', label: 'Projetos', icon: <IconBriefcase /> },
  { id: 'bolsas', label: 'Bolsas', icon: <IconBriefcase /> },
  { id: 'inscricoes', label: 'Inscrições', icon: <IconClipboardList /> },
  { id: 'usuarios', label: 'Usuários', icon: <IconUsers /> },
  { id: 'auditoria', label: 'Auditoria', icon: <IconClipboardList /> },
]

export default function AdministradorPage({ me, initials, onVoltarHub }) {
  const [active, setActive] = useState('dashboard')
  const [secaoMonitoramento, setSecaoMonitoramento] = useState(null)

  function navegar(destino, secao = null) {
    setSecaoMonitoramento(secao)
    setActive(destino)
  }

  return (
    <Layout
      role="Administrador"
      menuItems={menuItems}
      active={active}
      onNav={(destino) => navegar(destino)}
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

          <MonitoramentoPage onNavigate={navegar} />
        </>
      )}
      {active === 'editais' && <MonitoramentoPage secao="editais_ativos" />}
      {active === 'projetos' && <MonitoramentoPage secao="projetos_cadastrados" />}
      {active === 'bolsas' && <MonitoramentoPage secao="bolsas_ativas" />}
      {active === 'inscricoes' && (
        <MonitoramentoPage secao={secaoMonitoramento || 'inscricoes_ativas'} />
      )}
      {active === 'usuarios' && (
        <UsuariosPage
          filtroStatus={
            secaoMonitoramento === 'usuarios_ativos'
              ? true
              : secaoMonitoramento === 'usuarios_inativos'
                ? false
                : null
          }
        />
      )}
      {active === 'auditoria' && <AuditoriaPage />}
    </Layout>
  )
}
