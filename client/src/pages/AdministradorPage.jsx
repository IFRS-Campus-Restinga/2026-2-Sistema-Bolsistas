import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Layout,
  Button,
  PageHeader,
  IconHome,
  IconBolsa,
  IconClipboardCheck,
  IconEdital,
  IconFolder,
  IconHistory,
  IconUserCog,
} from '../components'
import UsuariosPage from './UsuariosPage'
import MonitoramentoPage from './MonitoramentoPage'
import PainelAdministrativo from './PainelAdministrativo'
import AuditoriaPage from './AuditoriaPage'
import AdminEditaisPage from './AdminEditaisPage'

const secoes = [
  { items: [{ id: 'dashboard', label: 'Início', icon: <IconHome /> }] },
  {
    title: 'Gestão',
    items: [
      { id: 'editais', label: 'Editais', icon: <IconEdital /> },
      { id: 'projetos', label: 'Projetos', icon: <IconFolder /> },
      { id: 'bolsas', label: 'Bolsas', icon: <IconBolsa /> },
      { id: 'inscricoes', label: 'Inscrições', icon: <IconClipboardCheck /> },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { id: 'usuarios', label: 'Usuários', icon: <IconUserCog /> },
      { id: 'auditoria', label: 'Auditoria', icon: <IconHistory /> },
    ],
  },
]

const ABAS = new Set(secoes.flatMap((secao) => secao.items.map((item) => item.id)))

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
      sections={secoes}
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
      {active === 'editais' && <AdminEditaisPage />}
      {active === 'projetos' && <MonitoramentoPage secao="projetos_cadastrados" />}
      {active === 'bolsas' && <MonitoramentoPage secao="bolsas_ativas" />}
      {active === 'inscricoes' && <MonitoramentoPage secao="inscricoes_ativas" />}
      {active === 'usuarios' && <UsuariosPage />}
      {active === 'auditoria' && <AuditoriaPage />}
    </Layout>
  )
}
