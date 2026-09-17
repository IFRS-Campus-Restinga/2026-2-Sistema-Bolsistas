import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthProvider'
import { useAuth } from './contexts/useAuth'
import { hubHomeUrlPara } from './api'
import ProtectedRoute from './components/ProtectedRoute'

import Showcase from './pages/Showcase'
import AcessoNegado from './pages/AcessoNegado'
import SemPermissao from './pages/SemPermissao'
import AdministradorPage from './pages/AdministradorPage'
import AlunoPage from './pages/AlunoPage'
import CoordenadorProjetoPage from './pages/CoordenadorProjetoPage'
import CoordenadorAreaPage from './pages/CoordenadorAreaPage'
import SolicitarBolsaPage from './pages/SolicitarBolsaPage'

import './styles/global.css'

function RedirecionaPorRole() {
  const { me, carregando } = useAuth()

  if (carregando) return null
  if (!me) return <Navigate to="/acesso-negado" replace />

  const rotas = {
    ADMINISTRADOR: '/administrador',
    ALUNO: '/aluno',
    COORDENADOR_AREA: '/coordenador-area',
    COORDENADOR_PROJETO: '/coordenador-projeto',
  }

  return <Navigate to={rotas[me.role] || '/acesso-negado'} replace />
}

function PageWrapper({ Component }) {
  const { me, initials } = useAuth()

  const onVoltarHub = () => {
    window.location.href = hubHomeUrlPara(me.role)
  }

  return <Component me={me} initials={initials} onVoltarHub={onVoltarHub} />
}

function AppRoutes() {
  const { erro } = useAuth()

  return (
    <Routes>
      {/* Públicas */}
      <Route path="/showcase" element={<Showcase />} />
      <Route path="/acesso-negado" element={<AcessoNegado mensagem={erro} />} />
      <Route path="/sem-permissao" element={<SemPermissao />} />

      {/* Raiz → redireciona por role */}
      <Route path="/" element={<RedirecionaPorRole />} />

      {/* Administrador */}
      <Route
        path="/administrador"
        element={
          <ProtectedRoute roles={['ADMINISTRADOR']}>
            <PageWrapper Component={AdministradorPage} />
          </ProtectedRoute>
        }
      />

      {/* Aluno */}
      <Route
        path="/aluno"
        element={
          <ProtectedRoute roles={['ALUNO']}>
            <PageWrapper Component={AlunoPage} />
          </ProtectedRoute>
        }
      />

      {/* Coordenador de Área */}
      <Route
        path="/coordenador-area"
        element={
          <ProtectedRoute roles={['COORDENADOR_AREA']}>
            <PageWrapper Component={CoordenadorAreaPage} />
          </ProtectedRoute>
        }
      />

      {/* Coordenador de Projeto */}
      <Route
        path="/coordenador-projeto"
        element={
          <ProtectedRoute roles={['COORDENADOR_PROJETO']}>
            <PageWrapper Component={CoordenadorProjetoPage} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordenador-projeto/solicitar-bolsa"
        element={
          <ProtectedRoute roles={['COORDENADOR_PROJETO']}>
            <PageWrapper Component={SolicitarBolsaPage} />
          </ProtectedRoute>
        }
      />

      {/* Qualquer outra rota → redireciona por role */}
      <Route path="*" element={<RedirecionaPorRole />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}