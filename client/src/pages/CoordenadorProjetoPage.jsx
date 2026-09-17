import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layout,
  PageHeader,
  Button,
  StatCard,
  IconHome,
  IconBriefcase,
  IconUsers,
  IconCheck,
  IconFileText,
  IconPlus,
} from '../components'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'projetos', label: 'Meus Projetos', icon: <IconBriefcase /> },
  { id: 'bolsistas', label: 'Bolsistas', icon: <IconUsers /> },
  { id: 'bolsas', label: 'Minhas Bolsas', icon: <IconFileText /> },
]

export default function CoordenadorProjetoPage({ me, initials, onVoltarHub }) {
  const [active, setActive] = useState('dashboard')
  const navigate = useNavigate()

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
      <PageHeader
        title="Painel do Coordenador de Projeto"
        action={
          <Button variant="accent" onClick={() => navigate('/coordenador-projeto/solicitar-bolsa')}>
            <IconPlus /> Solicitar Bolsa
          </Button>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <StatCard label="Meus Projetos" value={0} icon={<IconBriefcase />} color="green" />
        <StatCard label="Bolsistas Ativos" value={0} icon={<IconUsers />} color="blue" />
        <StatCard label="Vagas Abertas" value={0} icon={<IconCheck />} color="orange" />
      </div>
    </Layout>
  )
}
