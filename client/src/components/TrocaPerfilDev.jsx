import { useState } from 'react'
import { entrarComoPerfilDev } from '../api'
import { useAuth } from '../contexts/useAuth'
import { Spinner } from './Spinner'
import './TrocaPerfilDev.css'

const PERFIS = [
  { papel: 'aluno', role: 'ALUNO', label: 'Aluno' },
  { papel: 'coordenador-projeto', role: 'COORDENADOR_PROJETO', label: 'Coord. Projeto' },
  { papel: 'coordenador-area', role: 'COORDENADOR_AREA', label: 'Coord. Área' },
  { papel: 'admin', role: 'ADMINISTRADOR', label: 'Admin' },
]

export function TrocaPerfilDev() {
  const { me } = useAuth()
  const [trocandoPara, setTrocandoPara] = useState(null)
  const [erro, setErro] = useState('')

  if (!me?.modo_dev) return null

  async function trocar(papel) {
    setTrocandoPara(papel)
    setErro('')
    try {
      const res = await entrarComoPerfilDev(papel)
      if (!res.ok) throw new Error('Não foi possível trocar de perfil.')
      window.location.assign('/')
    } catch (e) {
      setErro(e.message)
      setTrocandoPara(null)
    }
  }

  return (
    <div className="troca-perfil-dev">
      <p className="troca-perfil-dev__titulo">Modo dev · trocar perfil</p>
      <div className="troca-perfil-dev__opcoes">
        {PERFIS.map((perfil) => {
          const atual = me.role === perfil.role
          return (
            <button
              key={perfil.papel}
              type="button"
              className={`troca-perfil-dev__opcao${atual ? ' troca-perfil-dev__opcao--atual' : ''}`}
              onClick={() => trocar(perfil.papel)}
              disabled={atual || trocandoPara !== null}
              aria-pressed={atual}
            >
              {trocandoPara === perfil.papel && <Spinner size={12} />}
              {perfil.label}
            </button>
          )
        })}
      </div>
      {erro && (
        <p className="troca-perfil-dev__erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
