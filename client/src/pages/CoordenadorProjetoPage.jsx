import { useState } from 'react'
import {
  Layout,
  IconHome,
  IconUsers,
  IconCalendar,
  IconCalendarCheck,
  IconFlag,
  IconFolder,
  IconFunnel,
  IconSend,
} from '../components'
import InicioProjetoPage from './InicioProjetoPage'
import MeusProjetosPage from './MeusProjetosPage'
import MeusConvitesPage from './MeusConvitesPage'
import SelecaoCandidatosPage from './SelecaoCandidatosPage'
import MeusBolsistasPage from './MeusBolsistasPage'
import FrequenciasPage from './FrequenciasPage'
import CronogramaEditaisPage from './CronogramaEditaisPage'
import FinalizacaoProjetoPage from './FinalizacaoProjetoPage'

const secoes = [
  {
    items: [
      { id: 'dashboard', label: 'Início', icon: <IconHome /> },
      { id: 'projetos', label: 'Meus projetos', icon: <IconFolder /> },
    ],
  },
  {
    title: 'Seleção',
    items: [
      { id: 'selecao', label: 'Seleção de candidatos', icon: <IconFunnel /> },
      { id: 'convites', label: 'Convites', icon: <IconSend /> },
      { id: 'cronograma', label: 'Cronograma', icon: <IconCalendar /> },
    ],
  },
  {
    title: 'Bolsistas',
    items: [
      { id: 'bolsistas', label: 'Meus bolsistas', icon: <IconUsers /> },
      { id: 'frequencias', label: 'Frequências', icon: <IconCalendarCheck /> },
      { id: 'finalizacao', label: 'Finalização', icon: <IconFlag /> },
    ],
  },
]

export default function CoordenadorProjetoPage({ me, initials, onVoltarHub }) {
  const [active, setActive] = useState('dashboard')

  return (
    <Layout
      role="Coordenador de Projeto"
      sections={secoes}
      active={active}
      onNav={setActive}
      onLogout={onVoltarHub}
      campus="Campus Restinga"
      userName={me.nome || '(sem nome)'}
      initials={initials}
    >
      {active === 'dashboard' && <InicioProjetoPage nome={me.nome} onNav={setActive} />}

      {active === 'projetos' && <MeusProjetosPage />}
      {active === 'selecao' && <SelecaoCandidatosPage />}
      {active === 'convites' && <MeusConvitesPage />}
      {active === 'bolsistas' && <MeusBolsistasPage />}
      {active === 'frequencias' && <FrequenciasPage />}
      {active === 'finalizacao' && <FinalizacaoProjetoPage />}
      {active === 'cronograma' && <CronogramaEditaisPage filtrarStatus={false} />}
    </Layout>
  )
}
