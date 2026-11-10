import { useEffect, useState } from 'react'
import { notificacoesFetch } from '../api'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import { Button } from './Button'
import { TextInput } from './FormField'
import { Spinner } from './Spinner'

const TRILHO =
  "h-full w-full rounded-full bg-gray-300 transition-[background] duration-150 ease-[ease] after:absolute after:top-[3px] after:left-[3px] after:size-4 after:rounded-full after:bg-white after:shadow-[0_1px_2px_rgba(0,0,0,0.2)] after:transition-transform after:duration-150 after:ease-[ease] after:content-[''] peer-checked:bg-if-green peer-checked:after:translate-x-4 peer-focus-visible:shadow-[0_0_0_3px_rgba(74,222,128,0.35)] peer-disabled:opacity-50"

// Cada aviso: interruptor que liga/desliga e quantidade de dias de inatividade.
const AVISOS = [
  {
    ativo: 'avisar_solicitacao_parada',
    dias: 'dias_solicitacao_parada',
    titulo: 'Solicitação de bolsa parada',
    descricao: 'Avisar quando uma solicitação aguardar análise do coordenador de área por mais de',
    minimo: 1,
  },
  {
    ativo: 'avisar_recurso_parado',
    dias: 'dias_recurso_parado',
    titulo: 'Recurso sem julgamento',
    descricao: 'Avisar quando um recurso seguir sem julgamento após o fim do período por mais de',
    minimo: 0,
  },
]

/**
 * Aba "Configurar" do sino do administrador: prazos de inatividade que geram avisos.
 */
export function PreferenciasPendencias() {
  const [valores, setValores] = useState(null)
  const [erros, setErros] = useState({})
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    let ativo = true
    notificacoesFetch('/preferencias/')
      .then(async (response) => {
        const dados = await response.json().catch(() => null)
        if (!response.ok || !dados) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar as preferências.'))
        }
        if (ativo) setValores(dados)
      })
      .catch((error) => {
        if (ativo) setErro(error.message || 'Falha ao conectar ao servidor.')
      })
    return () => {
      ativo = false
    }
  }, [])

  function alterar(campo, valor) {
    setValores((atuais) => ({ ...atuais, [campo]: valor }))
    setErros((atuais) => ({ ...atuais, [campo]: undefined }))
    setSalvo(false)
  }

  async function salvar(evento) {
    evento.preventDefault()
    setSalvando(true)
    setErro('')
    try {
      const response = await notificacoesFetch('/preferencias/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valores),
      })
      const dados = await response.json().catch(() => null)
      if (!response.ok) {
        setErros(dados ?? {})
        throw new Error(mensagemDeErro(dados, 'Não foi possível salvar as preferências.'))
      }
      setValores(dados)
      setSalvo(true)
    } catch (error) {
      setErro(error.message || 'Falha ao conectar ao servidor.')
    } finally {
      setSalvando(false)
    }
  }

  if (!valores) {
    return erro ? (
      <p className="px-4 py-8 text-center text-sm text-red-600">{erro}</p>
    ) : (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }

  return (
    <form onSubmit={salvar} className="flex flex-col">
      <p className="m-0 px-4 pt-3 text-xs leading-normal text-gray-500">
        Escolha depois de quanto tempo parado cada item gera um aviso para você.
      </p>

      {AVISOS.map((aviso) => {
        const ligado = valores[aviso.ativo]
        const erroDias = erros[aviso.dias]?.[0]
        return (
          <div key={aviso.ativo} className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-900">{aviso.titulo}</span>
              <label className="relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer">
                <input
                  className="peer absolute m-0 size-full cursor-[inherit] opacity-0"
                  type="checkbox"
                  role="switch"
                  aria-label={`Receber aviso de ${aviso.titulo.toLowerCase()}`}
                  checked={ligado}
                  onChange={(e) => alterar(aviso.ativo, e.target.checked)}
                />
                <span className={TRILHO} />
              </label>
            </div>
            <p className="m-0 mt-1 text-xs leading-normal text-gray-500">{aviso.descricao}</p>
            <div className="mt-2 flex items-center gap-2">
              <TextInput
                type="number"
                min={aviso.minimo}
                max={365}
                required
                disabled={!ligado}
                aria-label={`Dias para ${aviso.titulo.toLowerCase()}`}
                value={valores[aviso.dias]}
                onChange={(e) => alterar(aviso.dias, e.target.value)}
                className="w-20 tabular-nums"
              />
              <span className="text-sm text-gray-600">dias</span>
            </div>
            {erroDias && <p className="m-0 mt-1 text-xs text-red-600">{erroDias}</p>}
          </div>
        )
      })}

      <div className="flex items-center justify-end gap-3 px-4 py-3">
        {erro && <span className="mr-auto text-xs text-red-600">{erro}</span>}
        {salvo && !erro && (
          <span className="mr-auto text-xs text-gray-500">Preferências salvas.</span>
        )}
        <Button type="submit" size="sm" variant="primary" loading={salvando}>
          Salvar
        </Button>
      </div>
    </form>
  )
}
