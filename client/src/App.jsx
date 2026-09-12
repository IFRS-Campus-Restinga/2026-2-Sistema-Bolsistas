import { useEffect, useState } from 'react'
import { apiFetch, hubHomeUrlPara } from './api'

function AdministradorPage({ me, onVoltarHub }) {
  return (
    <div>
      <h1>Hello Administrador {me.nome || '(sem nome)'}</h1>
      <p>id: {me.id}</p>
      <button onClick={onVoltarHub}>Voltar ao HUB</button>
    </div>
  )
}

function AlunoPage({ me, onVoltarHub }) {
  return (
    <div>
      <h1>Hello Aluno {me.nome || '(sem nome)'}</h1>
      <p>id: {me.id}</p>
      <p>email: {me.email || '(sem email)'}</p>
      <button onClick={onVoltarHub}>Voltar ao HUB</button>
    </div>
  )
}

function CoordenadorProjetoPage({ me, onVoltarHub }) {
  return (
    <div>
      <h1>Hello Coordenador de Projeto {me.nome || '(sem nome)'}</h1>
      <p>id: {me.id}</p>
      <p>email: {me.email || '(sem email)'}</p>
      <button onClick={onVoltarHub}>Voltar ao HUB</button>
    </div>
  )
}

function CoordenadorAreaPage({ me, onVoltarHub }) {
  return (
    <div>
      <h1>
        Hello Coordenador de {me.tipo_area || 'Área'} {me.nome || '(sem nome)'}
      </h1>
      <p>id: {me.id}</p>
      <p>email: {me.email || '(sem email)'}</p>
      <button onClick={onVoltarHub}>Voltar ao HUB</button>
    </div>
  )
}

function AcessoNegado({ mensagem }) {
  return (
    <div>
      <h1>Acesso negado</h1>
      <p>{mensagem}</p>
    </div>
  )
}

export default function App() {
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
