import { useState } from 'react'
import {
  Layout,
  PageHeader,
  StatCard,
  IconHome,
  IconBriefcase,
  IconUsers,
  IconCheck,
  IconScale,
  IconCalendarCheck,
  IconFlag,
  IconFolder,
  IconFunnel,
  IconSend,
} from '../components'
import MeusProjetosPage from './MeusProjetosPage'
import MeusCandidatosPage from './MeusCandidatosPage'
import MeusConvitesPage from './MeusConvitesPage'
import SelecaoPage from './SelecaoPage'
import MeusBolsistasPage from './MeusBolsistasPage'
import FrequenciasPage from './FrequenciasPage'
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
    // Meus candidatos e Avaliação e seleção viram uma tab só na US94.
    items: [
      { id: 'candidatos', label: 'Meus candidatos', icon: <IconFunnel /> },
      { id: 'selecao', label: 'Avaliação e seleção', icon: <IconScale /> },
      { id: 'convites', label: 'Convites', icon: <IconSend /> },
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
      {active === 'frequencias' && <FrequenciasPage />}
      {active === 'finalizacao' && <FinalizacaoProjetoPage />}
    </Layout>
  )
}
