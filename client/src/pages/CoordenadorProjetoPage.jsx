import { useState } from 'react'
import {
  Layout,
  PageHeader,
  StatCard,
  IconHome,
  IconBriefcase,
  IconUsers,
  IconCheck,
  IconFileText,
} from '../components'
import MeusProjetosPage from './MeusProjetosPage'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'projetos', label: 'Meus Projetos', icon: <IconBriefcase /> },
  { id: 'bolsistas', label: 'Bolsistas', icon: <IconUsers /> },
  { id: 'bolsas', label: 'Minhas Bolsas', icon: <IconFileText /> },
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <StatCard label="Meus Projetos" value={0} icon={<IconBriefcase />} color="green" />
            <StatCard label="Bolsistas Ativos" value={0} icon={<IconUsers />} color="blue" />
            <StatCard label="Vagas Abertas" value={0} icon={<IconCheck />} color="orange" />
          </div>
        </>
      )}

      {active === 'projetos' && <MeusProjetosPage />}
    </Layout>
  )
}
