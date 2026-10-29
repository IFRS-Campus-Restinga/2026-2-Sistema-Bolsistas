import { useState } from 'react'
import {
  Layout,
  PageHeader,
  StatCard,
  IconHome,
  IconCalendar,
  IconBriefcase,
  IconUsers,
  IconCheck,
  IconClipboardList,
  IconBarChart,
  IconAlertTriangle,
} from '../components'
import EditaisPage from './EditaisPage'
import SolicitacoesBolsaPage from './SolicitacoesBolsaPage'
import FinalizacaoBolsasPage from './FinalizacaoBolsasPage'
import MovimentacoesBolsistasPage from './MovimentacoesBolsistasPage'
import SituacaoFrequenciasPage from './SituacaoFrequenciasPage'
import PendenciasAreaPage from './PendenciasAreaPage'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'editais', label: 'Editais', icon: <IconCalendar /> },
  { id: 'solicitacoes', label: 'Solicitações de Bolsa', icon: <IconBriefcase /> },
  { id: 'finalizacao', label: 'Finalização de Bolsas', icon: <IconCheck /> },
  {
    id: 'movimentacoes',
    label: 'Desligamentos e Cancelamentos',
    icon: <IconClipboardList />,
  },
  { id: 'frequencias', label: 'Situação das Frequências', icon: <IconBarChart /> },
  { id: 'pendencias', label: 'Relatório de Pendências', icon: <IconAlertTriangle /> },
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
          <div className="grid grid-cols-[repeat(3,1fr)] gap-4">
            <StatCard label="Editais Ativos" value={0} icon={<IconCalendar />} color="green" />
            <StatCard label="Projetos da Área" value={0} icon={<IconBriefcase />} color="blue" />
            <StatCard label="Bolsistas Ativos" value={0} icon={<IconUsers />} color="orange" />
          </div>
        </>
      )}

      {active === 'solicitacoes' && <SolicitacoesBolsaPage />}
      {active === 'finalizacao' && <FinalizacaoBolsasPage />}
      {active === 'movimentacoes' && <MovimentacoesBolsistasPage />}
      {active === 'frequencias' && <SituacaoFrequenciasPage />}
      {active === 'pendencias' && <PendenciasAreaPage />}
    </Layout>
  )
}
