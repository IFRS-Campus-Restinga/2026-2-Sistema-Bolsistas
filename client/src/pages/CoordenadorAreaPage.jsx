import { useState } from 'react'
import {
  Layout,
  IconHome,
  IconAlertTriangle,
  IconArrowLeftRight,
  IconCalendar,
  IconCalendarCheck,
  IconEdital,
  IconFlag,
  IconInbox,
} from '../components'
import EditaisPage from './EditaisPage'
import CronogramaEditaisPage from './CronogramaEditaisPage'
import InicioAreaPage from './InicioAreaPage'
import SolicitacoesBolsaPage from './SolicitacoesBolsaPage'
import FinalizacaoBolsasPage from './FinalizacaoBolsasPage'
import MovimentacoesBolsistasPage from './MovimentacoesBolsistasPage'
import SituacaoFrequenciasPage from './SituacaoFrequenciasPage'
import PendenciasAreaPage from './PendenciasAreaPage'

const secoes = [
  { items: [{ id: 'dashboard', label: 'Início', icon: <IconHome /> }] },
  {
    title: 'Gestão',
    items: [
      { id: 'editais', label: 'Editais', icon: <IconEdital /> },
      { id: 'cronograma', label: 'Cronograma', icon: <IconCalendar /> },
      { id: 'solicitacoes', label: 'Solicitações de bolsa', icon: <IconInbox /> },
    ],
  },
  {
    title: 'Acompanhamento',
    items: [
      { id: 'frequencias', label: 'Frequências', icon: <IconCalendarCheck /> },
      { id: 'pendencias', label: 'Pendências', icon: <IconAlertTriangle /> },
      { id: 'movimentacoes', label: 'Movimentações', icon: <IconArrowLeftRight /> },
      { id: 'finalizacao', label: 'Finalização', icon: <IconFlag /> },
    ],
  },
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
      role={`Coordenador de Área · ${areaLabel}`}
      sections={secoes}
      active={active}
      onNav={setActive}
      onLogout={onVoltarHub}
      campus="Campus Restinga"
      userName={me.nome || '(sem nome)'}
      initials={initials}
    >
      {active === 'editais' && <EditaisPage />}
      {active === 'cronograma' && <CronogramaEditaisPage podeVerHistorico />}

      {active === 'dashboard' && <InicioAreaPage areaLabel={areaLabel} onNav={setActive} />}

      {active === 'solicitacoes' && <SolicitacoesBolsaPage />}
      {active === 'finalizacao' && <FinalizacaoBolsasPage />}
      {active === 'movimentacoes' && <MovimentacoesBolsistasPage />}
      {active === 'frequencias' && <SituacaoFrequenciasPage />}
      {active === 'pendencias' && <PendenciasAreaPage />}
    </Layout>
  )
}
