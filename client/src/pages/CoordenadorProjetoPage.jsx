import { useState } from 'react'
import {
  Layout,
  PageHeader,
  StatCard,
  IconHome,
  IconBriefcase,
  IconUsers,
  IconCheck,
  IconMail,
  IconScale,
  IconGradCap,
} from '../components'
import MeusProjetosPage from './MeusProjetosPage'
import MeusCandidatosPage from './MeusCandidatosPage'
import MeusConvitesPage from './MeusConvitesPage'
import SelecaoPage from './SelecaoPage'
import MeusBolsistasPage from './MeusBolsistasPage'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'projetos', label: 'Meus Projetos', icon: <IconBriefcase /> },
  { id: 'candidatos', label: 'Meus Candidatos', icon: <IconUsers /> },
  { id: 'selecao', label: 'Avaliação e Seleção', icon: <IconScale /> },
  { id: 'convites', label: 'Meus Convites', icon: <IconMail /> },
  { id: 'bolsistas', label: 'Meus Bolsistas', icon: <IconGradCap /> },
]

export default function CoordenadorProjetoPage({ me, initials, onVoltarHub }) {
  const [active, setActive] = useState('dashboard')

  return (
    <Layout
      role="Coordenador de Projeto"
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
          <PageHeader title="Painel do Coordenador de Projeto" />
          <div className="grid grid-cols-[repeat(3,1fr)] gap-4">
            <StatCard label="Meus Projetos" value={0} icon={<IconBriefcase />} color="green" />
            <StatCard label="Bolsistas Ativos" value={0} icon={<IconUsers />} color="blue" />
            <StatCard label="Vagas Abertas" value={0} icon={<IconCheck />} color="orange" />
          </div>
        </>
      )}

      {active === 'projetos' && <MeusProjetosPage />}
      {active === 'candidatos' && <MeusCandidatosPage />}
      {active === 'selecao' && <SelecaoPage />}
      {active === 'convites' && <MeusConvitesPage />}
      {active === 'bolsistas' && <MeusBolsistasPage />}
    </Layout>
  )
}
