import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import PainelAdministrativo from './PainelAdministrativo'
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

const ABAS = new Set(menuItems.map((item) => item.id))

export default function AdministradorPage({ me, initials, onVoltarHub }) {
  const [parametros, setParametros] = useSearchParams()
  const [active, setActive] = useState(() =>
    ABAS.has(parametros.get('aba')) ? parametros.get('aba') : 'dashboard'
  )

  function navegar(destino) {
    setActive(destino)
    // A aba fica na URL (recarregar mantém a tela); os filtros da aba anterior saem.
    setParametros(destino === 'dashboard' ? {} : { aba: destino }, { replace: true })
  }

  return (
    <Layout
      role="Administrador"
      menuItems={menuItems}
      active={active}
      onNav={navegar}
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

          <PainelAdministrativo onNavigate={navegar} />
        </>
      )}
      {active === 'editais' && <MonitoramentoPage secao="editais_ativos" />}
      {active === 'projetos' && <MonitoramentoPage secao="projetos_cadastrados" />}
      {active === 'bolsas' && <MonitoramentoPage secao="bolsas_ativas" />}
      {active === 'inscricoes' && <MonitoramentoPage secao="inscricoes_ativas" />}
      {active === 'usuarios' && <UsuariosPage />}
      {active === 'auditoria' && <AuditoriaPage />}
    </Layout>
  )
}
