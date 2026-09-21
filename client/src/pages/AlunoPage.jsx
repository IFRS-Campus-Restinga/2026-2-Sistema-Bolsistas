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
} from '../components'

import BolsasDisponiveisPage from './BolsasDisponiveisPage'
import MinhasInscricoesPage from './MinhasInscricoesPage'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'bolsas', label: 'Bolsas Disponíveis', icon: <IconBriefcase /> },
  { id: 'inscricoes', label: 'Minhas Inscrições', icon: <IconClipboardList /> },
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

          <Banner
            title="Editais de Iniciação Científica e Extensão Abertos!"
            description="Confira as vagas disponíveis e inscreva-se dentro do prazo do edital."
            action={
              <Button variant="primary" onClick={() => setActive('bolsas')}>
                Ver Projetos Disponíveis
              </Button>
            }
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <StatCard
              label="Bolsas Abertas"
              value={totalBolsas ?? '—'}
              icon={<IconBriefcase />}
              color="green"
              clickable
              onClick={() => setActive('bolsas')}
            />
            <StatCard
              label="Minhas Inscrições"
              value={totalInscricoes ?? '—'}
              icon={<IconClipboardList />}
              color="blue"
              clickable
              onClick={() => setActive('inscricoes')}
            />
          </div>
        </div>
      )}

      {active === 'bolsas' && <BolsasDisponiveisPage />}

      {active === 'inscricoes' && <MinhasInscricoesPage />}
    </Layout>
  )
}
