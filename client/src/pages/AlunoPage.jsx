import { useEffect, useState } from 'react'
import { bolsistasFetch, dadosBancariosFetch } from '../api'
import {
  Badge,
  Layout,
  IconHome,
  IconBank,
  IconMail,
  IconAward,
  IconCalendarCheck,
  IconClipboardCheck,
  IconCompass,
  IconGavel,
} from '../components'

import BolsasDisponiveisPage from './BolsasDisponiveisPage'
import InicioAlunoPage from './InicioAlunoPage'
import MinhasInscricoesPage from './MinhasInscricoesPage'
import MeusRecursosPage from './MeusRecursosPage'
import DadosBancariosPage from './DadosBancariosPage'
import ConvitesPage from './ConvitesPage'
import MinhaBolsaPage from './MinhaBolsaPage'
import MinhaFrequenciaPage from './MinhaFrequenciaPage'

const secoes = [
  { items: [{ id: 'dashboard', label: 'Início', icon: <IconHome /> }] },
  {
    title: 'Oportunidades',
    items: [
      { id: 'bolsas', label: 'Bolsas disponíveis', icon: <IconCompass /> },
      { id: 'convites', label: 'Convites', icon: <IconMail /> },
    ],
  },
  {
    title: 'Candidaturas',
    items: [
      { id: 'inscricoes', label: 'Minhas inscrições', icon: <IconClipboardCheck /> },
      { id: 'recursos', label: 'Meus recursos', icon: <IconGavel /> },
    ],
  },
  {
    title: 'Minha bolsa',
    items: [
      { id: 'minha-bolsa', label: 'Minha bolsa', icon: <IconAward /> },
      { id: 'minha-frequencia', label: 'Minha frequência', icon: <IconCalendarCheck /> },
    ],
  },
]

/**
 * Situação dos dados bancários do aluno. Recalcula a cada troca de tab, para o aviso
 * sumir logo depois que o aluno salva o cadastro.
 */
function useDadosBancarios(active) {
  const [situacao, setSituacao] = useState({ pendente: false, temBolsa: false })

  useEffect(() => {
    let ativo = true
    Promise.all([
      dadosBancariosFetch('/').then((res) => (res.ok ? res.json() : null)),
      bolsistasFetch('/meus-vinculos/').then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([dados, vinculos]) => {
        if (!ativo || !dados) return
        setSituacao({
          pendente: !dados.cadastro_completo,
          temBolsa: Array.isArray(vinculos) && vinculos.some((v) => v.status === 'ATIVO'),
        })
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [active])

  return situacao
}

export default function AlunoPage({ me, initials, onVoltarHub }) {
  const [active, setActive] = useState('dashboard')
  const banco = useDadosBancarios(active)

  return (
    <Layout
      role="Aluno"
      sections={secoes}
      active={active}
      onNav={setActive}
      onLogout={onVoltarHub}
      campus="Campus Restinga"
      userName={me.nome || '(sem nome)'}
      initials={initials}
      accountItems={[
        {
          id: 'dados-bancarios',
          label: 'Dados bancários',
          icon: <IconBank />,
          hint: banco.pendente ? <Badge status="PENDENTE" label="Pendente" /> : undefined,
          onClick: () => setActive('dados-bancarios'),
        },
      ]}
    >
      {active === 'dashboard' && <InicioAlunoPage nome={me.nome} onNav={setActive} />}

      {active === 'bolsas' && <BolsasDisponiveisPage />}

      {active === 'inscricoes' && (
        <MinhasInscricoesPage onHistorico={() => setActive('recursos')} />
      )}
      {active === 'recursos' && <MeusRecursosPage />}
      {active === 'convites' && <ConvitesPage />}
      {active === 'minha-bolsa' && <MinhaBolsaPage onNav={setActive} />}
      {active === 'minha-frequencia' && <MinhaFrequenciaPage />}
      {active === 'dados-bancarios' && <DadosBancariosPage />}
    </Layout>
  )
}
