import { useState } from 'react'
import {
  Layout,
  PageHeader,
  StatCard,
  IconHome,
  IconCalendar,
  IconBriefcase,
  IconUsers,
} from '../components'
import EditaisPage from './EditaisPage'
import SolicitacoesBolsaPage from './SolicitacoesBolsaPage'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'editais', label: 'Editais', icon: <IconCalendar /> },
  { id: 'solicitacoes', label: 'Solicitações de Bolsa', icon: <IconBriefcase /> },
]

const AREA_LABELS = {
  EXTENSAO: 'Extensão',
  PESQUISA: 'Pesquisa',
  ENSINO: 'Ensino',
}

export default function CoordenadorAreaPage({ me, initials, onVoltarHub }) {
  const [active, setActive] = useState('dashboard')
  const areaLabel = AREA_LABELS[me.tipo_area] || me.tipo_area || 'Área'

  return (
    <Layout
      role={`Coordenador de ${areaLabel}`}
      menuItems={menuItems}
      active={active}
      onNav={setActive}
      onLogout={onVoltarHub}
      campus="Campus Restinga"
      userName={me.nome || '(sem nome)'}
      initials={initials}
    >
      {active === 'editais' && <EditaisPage />}

      {active === 'dashboard' && (
        <>
          <PageHeader title={`Painel Coordenação de ${areaLabel}`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <StatCard label="Editais Ativos" value={0} icon={<IconCalendar />} color="green" />
            <StatCard label="Projetos da Área" value={0} icon={<IconBriefcase />} color="blue" />
            <StatCard label="Bolsistas Ativos" value={0} icon={<IconUsers />} color="orange" />
          </div>
        </>
      )}

      {active === 'solicitacoes' && <SolicitacoesBolsaPage />}
    </Layout>
  )
}
