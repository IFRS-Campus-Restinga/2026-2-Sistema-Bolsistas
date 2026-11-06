import { useState } from 'react'
import { entrarComoPerfilDev } from '../api'
import { useAuth } from '../contexts/useAuth'
import { Spinner } from './Spinner'

const PERFIS = [
  { papel: 'aluno', role: 'ALUNO', label: 'Aluno' },
  { papel: 'coordenador-projeto', role: 'COORDENADOR_PROJETO', label: 'Coord. Projeto' },
  { papel: 'coordenador-area', role: 'COORDENADOR_AREA', label: 'Coord. Área' },
  { papel: 'admin', role: 'ADMINISTRADOR', label: 'Admin' },
]

const OPCAO =
  'inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-2xs leading-[normal] font-semibold disabled:cursor-default'
const OPCAO_NORMAL = `${OPCAO} border-amber-300 bg-white text-amber-800 enabled:hover:bg-amber-100`
const OPCAO_ATUAL = `${OPCAO} border-amber-500 bg-amber-500 text-white`

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
    <div className="mb-3 rounded-xl border border-dashed border-amber-500 bg-amber-50 p-2.5">
      <p className="mb-2 text-[10px] font-bold tracking-[0.08em] text-amber-700 uppercase">
        Modo dev · trocar perfil
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {PERFIS.map((perfil) => {
          const atual = me.role === perfil.role
          return (
            <button
              key={perfil.papel}
              type="button"
              className={atual ? OPCAO_ATUAL : OPCAO_NORMAL}
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
        <p className="mt-1.5 text-2xs text-red-600" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
