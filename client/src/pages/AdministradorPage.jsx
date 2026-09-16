import { useState } from 'react'
import {
  Layout,
  Button,
  PageHeader,
  StatCard,
  IconHome,
  IconCalendar,
  IconBriefcase,
  IconUsers,
} from '../components'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'editais', label: 'Editais', icon: <IconCalendar /> },
  { id: 'projetos', label: 'Projetos', icon: <IconBriefcase /> },
  { id: 'usuarios', label: 'Usuários', icon: <IconUsers /> },
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
      <PageHeader
        title="Painel Administrativo"
        action={
          <Button variant="outline" size="sm" onClick={() => (window.location.href = '/showcase')}>
            Ver Showcase
          </Button>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="Editais Ativos" value={0} icon={<IconCalendar />} color="green" />
        <StatCard label="Projetos Cadastrados" value={0} icon={<IconBriefcase />} color="blue" />
        <StatCard label="Usuários Ativos" value={0} icon={<IconUsers />} color="green" />
        <StatCard label="Usuários Inativos" value={0} icon={<IconUsers />} color="red" />
      </div>
    </Layout>
  )
}
