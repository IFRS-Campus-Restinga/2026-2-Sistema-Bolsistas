import { useEffect, useState } from 'react'
import { bolsasFetch, inscricoesFetch } from '../api'
import {
  Banner,
  Button,
  Layout,
  PageHeader,
  StatCard,
  IconBriefcase,
  IconHome,
  IconClipboardList,
  IconBank,
  IconMail,
  IconAward,
  IconCalendarCheck,
  IconClipboardCheck,
  IconCompass,
  IconGavel,
} from '../components'

import BolsasDisponiveisPage from './BolsasDisponiveisPage'
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
  // Dados bancários sai do menu e vai para o menu do avatar na #464.
  {
    title: 'Conta',
    items: [{ id: 'dados-bancarios', label: 'Dados bancários', icon: <IconBank /> }],
  },
]

export default function AlunoPage({ me, initials, onVoltarHub }) {
  const [active, setActive] = useState('dashboard')
  const [totalBolsas, setTotalBolsas] = useState(null)
  const [totalInscricoes, setTotalInscricoes] = useState(null)

  useEffect(() => {
    if (active !== 'dashboard') return undefined
    let ativo = true

    bolsasFetch('/disponiveis/')
      .then((res) => (res.ok ? res.json() : []))
      .then((dados) => {
        if (ativo) setTotalBolsas(Array.isArray(dados) ? dados.length : 0)
      })
      .catch(() => {
        if (ativo) setTotalBolsas(0)
      })

    inscricoesFetch('/')
      .then((res) => (res.ok ? res.json() : []))
      .then((dados) => {
        const pendentes = Array.isArray(dados)
          ? dados.filter((inscricao) => inscricao.status === 'PENDENTE').length
          : 0
        if (ativo) setTotalInscricoes(pendentes)
      })
      .catch(() => {
        if (ativo) setTotalInscricoes(0)
      })

    return () => {
      ativo = false
    }
  }, [active])

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
    >
      {active === 'dashboard' && (
        <div>
          <PageHeader title="Painel do Aluno" />

          <Banner
            title="Editais de Iniciação Científica e Extensão Abertos!"
            description="Confira as vagas disponíveis e inscreva-se dentro do prazo do edital."
            action={
              <Button variant="primary" onClick={() => setActive('bolsas')}>
                Ver Projetos Disponíveis
              </Button>
            }
          />

          <div className="grid grid-cols-[repeat(3,1fr)] gap-4">
            <StatCard
              label="Bolsas Abertas"
              value={totalBolsas ?? '0'}
              icon={<IconBriefcase />}
              color="green"
              clickable
              onClick={() => setActive('bolsas')}
            />
            <StatCard
              label="Minhas Inscrições"
              value={totalInscricoes ?? '0'}
              icon={<IconClipboardList />}
              color="blue"
              clickable
              onClick={() => setActive('inscricoes')}
            />
          </div>
        </div>
      )}

      {active === 'bolsas' && <BolsasDisponiveisPage />}

      {active === 'inscricoes' && (
        <MinhasInscricoesPage onHistorico={() => setActive('recursos')} />
      )}
      {active === 'recursos' && <MeusRecursosPage />}
      {active === 'convites' && <ConvitesPage />}
      {active === 'minha-bolsa' && <MinhaBolsaPage />}
      {active === 'minha-frequencia' && <MinhaFrequenciaPage />}
      {active === 'dados-bancarios' && <DadosBancariosPage />}
    </Layout>
  )
}
