import { useEffect, useState } from 'react'
import { apiFetch, hubHomeUrlPara } from './api'
import Showcase from './pages/Showcase'
import {
  Layout,
  Button,
  PageHeader,
  StatCard,
  IconHome,
  IconCalendar,
  IconBriefcase,
  IconUsers,
  IconFileText,
  IconClipboardList,
  IconCheck,
} from './components'
import './styles/global.css'

/* ── Menus por role ───────────────────────────────────────── */
const adminMenu = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'editais', label: 'Editais', icon: <IconCalendar /> },
  { id: 'projetos', label: 'Projetos', icon: <IconBriefcase /> },
  { id: 'usuarios', label: 'Usuários', icon: <IconUsers /> },
]

const coordAreaMenu = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'editais', label: 'Editais', icon: <IconCalendar /> },
  { id: 'projetos', label: 'Projetos', icon: <IconBriefcase /> },
]

const coordProjetoMenu = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'projetos', label: 'Meus Projetos', icon: <IconBriefcase /> },
  { id: 'bolsistas', label: 'Bolsistas', icon: <IconUsers /> },
]

const alunoMenu = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'editais', label: 'Editais Abertos', icon: <IconCalendar /> },
  { id: 'inscricoes', label: 'Minhas Inscrições', icon: <IconClipboardList /> },
  { id: 'documentos', label: 'Documentos', icon: <IconFileText /> },
]

/* ── Helper: iniciais do nome ─────────────────────────────── */
function iniciais(nome) {
  if (!nome) return '?'
  const partes = nome.trim().split(' ')
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/* ── Pages ────────────────────────────────────────────────── */
function AdministradorPage({ me, onVoltarHub }) {
  const [active, setActive] = useState('dashboard')

  return (
    <Layout
      role="Administrador"
      menuItems={adminMenu}
      active={active}
      onNav={setActive}
      onLogout={onVoltarHub}
      campus="Campus Restinga"
      userName={me.nome || '(sem nome)'}
      initials={iniciais(me.nome)}
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

function AlunoPage({ me, onVoltarHub }) {
  const [active, setActive] = useState('dashboard')

  return (
    <Layout
      role="Aluno"
      menuItems={alunoMenu}
      active={active}
      onNav={setActive}
      onLogout={onVoltarHub}
      campus="Campus Restinga"
      userName={me.nome || '(sem nome)'}
      initials={iniciais(me.nome)}
    >
      <PageHeader title="Painel do Aluno" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <StatCard label="Editais Abertos" value={0} icon={<IconCalendar />} color="green" />
        <StatCard label="Minhas Inscrições" value={0} icon={<IconClipboardList />} color="blue" />
        <StatCard label="Documentos Pendentes" value={0} icon={<IconFileText />} color="orange" />
      </div>
    </Layout>
  )
}

function CoordenadorProjetoPage({ me, onVoltarHub }) {
  const [active, setActive] = useState('dashboard')

  return (
    <Layout
      role="Coordenador de Projeto"
      menuItems={coordProjetoMenu}
      active={active}
      onNav={setActive}
      onLogout={onVoltarHub}
      campus="Campus Restinga"
      userName={me.nome || '(sem nome)'}
      initials={iniciais(me.nome)}
    >
      <PageHeader title="Painel do Coordenador de Projeto" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <StatCard label="Meus Projetos" value={0} icon={<IconBriefcase />} color="green" />
        <StatCard label="Bolsistas Ativos" value={0} icon={<IconUsers />} color="blue" />
        <StatCard label="Vagas Abertas" value={0} icon={<IconCheck />} color="orange" />
      </div>
    </Layout>
  )
}

function CoordenadorAreaPage({ me, onVoltarHub }) {
  const [active, setActive] = useState('dashboard')
  const areaLabel = me.tipo_area || 'Área'

  return (
    <Layout
      role={`Coordenador de ${areaLabel}`}
      menuItems={coordAreaMenu}
      active={active}
      onNav={setActive}
      onLogout={onVoltarHub}
      campus="Campus Restinga"
      userName={me.nome || '(sem nome)'}
      initials={iniciais(me.nome)}
    >
      <PageHeader title={`Painel — Coordenação de ${areaLabel}`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <StatCard label="Editais Ativos" value={0} icon={<IconCalendar />} color="green" />
        <StatCard label="Projetos da Área" value={0} icon={<IconBriefcase />} color="blue" />
        <StatCard label="Bolsistas Ativos" value={0} icon={<IconUsers />} color="orange" />
      </div>
    </Layout>
  )
}

function AcessoNegado({ mensagem }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 8 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827' }}>Acesso negado</h1>
      <p style={{ color: '#6b7280' }}>{mensagem}</p>
    </div>
  )
}

/* ── Main App (com autenticação) ──────────────────────────── */
function MainApp() {
  const [me, setMe] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    apiFetch('/whoami/')
      .then(async (res) => {
        if (!res.ok) {
          const corpo = await res.json().catch(() => null)
          throw new Error(corpo?.detail || 'Não autenticado — acesse este sistema a partir do HUB.')
        }
        setMe(await res.json())
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  const voltarAoHub = () => {
    window.location.href = hubHomeUrlPara(me.role)
  }

  if (carregando) return null
  if (!me) return <AcessoNegado mensagem={erro} />
  if (me.role === 'ADMINISTRADOR') return <AdministradorPage me={me} onVoltarHub={voltarAoHub} />
  if (me.role === 'ALUNO') return <AlunoPage me={me} onVoltarHub={voltarAoHub} />
  if (me.role === 'COORDENADOR_AREA')
    return <CoordenadorAreaPage me={me} onVoltarHub={voltarAoHub} />
  return <CoordenadorProjetoPage me={me} onVoltarHub={voltarAoHub} />
}

/* ── Router ───────────────────────────────────────────────── */
export default function App() {
  const path = window.location.pathname
  if (path === '/showcase' || path === '/showcase/') {
    return <Showcase />
  }
  return <MainApp />
}