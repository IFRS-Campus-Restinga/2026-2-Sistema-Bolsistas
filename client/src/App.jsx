import { useEffect, useState } from 'react'
import { apiFetch, hubHomeUrlPara } from './api'
import Showcase from './pages/Showcase'
import AdministradorPage from './pages/AdministradorPage'
import AlunoPage from './pages/AlunoPage'
import CoordenadorProjetoPage from './pages/CoordenadorProjetoPage'
import CoordenadorAreaPage from './pages/CoordenadorAreaPage'
import AcessoNegado from './pages/AcessoNegado'
import './styles/global.css'

function iniciais(nome) {
  if (!nome) return '?'
  const partes = nome.trim().split(' ')
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function MainApp() {
  const [me, setMe] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    // Limpa a URL longa do HUB imediatamente
    if (window.location.pathname !== '/' || window.location.search) {
      window.history.replaceState(null, '', '/')
    }

    apiFetch('/whoami/')
      .then(async (res) => {
        if (!res.ok) {
          const corpo = await res.json().catch(() => null)
          throw new Error(corpo?.detail || 'Não autenticado — acesse este sistema a partir do HUB.')
        }
        setMe(await res.json())
      })
      .catch((e) => {
        if (e.message === 'Failed to fetch') {
          setErro('Não foi possível conectar ao servidor. Verifique se o sistema está online.')
        } else if (e.name === 'SessaoExpiradaError') {
          setErro('Sua sessão expirou. Faça login novamente pelo HUB.')
        } else {
          setErro(e.message)
        }
      })
      .finally(() => setCarregando(false))
  }, [])

  const voltarAoHub = () => {
    window.location.href = hubHomeUrlPara(me.role)
  }

  if (carregando) return null
  if (!me) return <AcessoNegado mensagem={erro} />

  const props = { me, initials: iniciais(me.nome), onVoltarHub: voltarAoHub }

  if (me.role === 'ADMINISTRADOR') return <AdministradorPage {...props} />
  if (me.role === 'ALUNO') return <AlunoPage {...props} />
  if (me.role === 'COORDENADOR_AREA') return <CoordenadorAreaPage {...props} />
  return <CoordenadorProjetoPage {...props} />
}

export default function App() {
  const path = window.location.pathname
  if (path === '/showcase' || path === '/showcase/') {
    return <Showcase />
  }
  return <MainApp />
}
