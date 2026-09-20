import { useState } from 'react'
import {
  Layout,
  PageHeader,
  StatCard,
  IconHome,
  IconCalendar,
  IconClipboardList,
  IconFileText,
} from '../components'
import BolsasDisponiveisPage from './BolsasDisponiveisPage'
import MinhasInscricoesPage from './MinhasInscricoesPage'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'bolsas', label: 'Bolsas Disponíveis', icon: <IconCalendar /> },
  { id: 'inscricoes', label: 'Minhas Inscrições', icon: <IconClipboardList /> },
  { id: 'documentos', label: 'Meus Documentos', icon: <IconFileText /> },
]

export default function AlunoPage({ me, initials, onVoltarHub }) {
  const [active, setActive] = useState('dashboard')

  return (
    <Layout
      role="Aluno"
      menuItems={menuItems}
      active={active}
      onNav={setActive}
      onLogout={onVoltarHub}
      campus="Campus Restinga"
      userName={me.nome || '(sem nome)'}
      initials={initials}
    >
      {active === 'dashboard' && (
        <div>
          <PageHeader title="Painel do Aluno" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <StatCard label="Editais Abertos" value={0} icon={<IconCalendar />} color="green" />
            <StatCard
              label="Minhas Inscrições"
              value={0}
              icon={<IconClipboardList />}
              color="blue"
            />
            <StatCard
              label="Documentos Pendentes"
              value={0}
              icon={<IconFileText />}
              color="orange"
            />
          </div>
        </div>
      )}

      {active === 'bolsas' && <BolsasDisponiveisPage />}

      {active === 'inscricoes' && <MinhasInscricoesPage />}
    </Layout>
  )
}
