import { useEffect, useRef, useState } from 'react'
import { notificacoesFetch } from '../api'
import { formatarDataHora } from '../utils/dataHora'
import { IconBell } from './Icons'
import { Spinner } from './Spinner'

const INTERVALO_ATUALIZACAO = 60_000

const COR_POR_TOM = {
  INFO: 'bg-blue-500',
  SUCESSO: 'bg-green-500',
  AVISO: 'bg-amber-500',
  ERRO: 'bg-red-500',
}

const FILTROS = [
  { id: 'todas', label: 'Todas' },
  { id: 'nao_lidas', label: 'Não lidas' },
]

const ABA = 'cursor-pointer rounded-lg border-0 px-3 py-1.5 text-sm font-semibold transition-colors'

async function buscarNotificacoes(filtro) {
  const sufixo = filtro === 'nao_lidas' ? '?nao_lidas=1' : ''
  const response = await notificacoesFetch(`/${sufixo}`)
  const dados = await response.json().catch(() => null)
  if (!response.ok || !Array.isArray(dados?.resultados)) {
    throw new Error('Não foi possível carregar as notificações.')
  }
  return dados
}

/**
 * Sino da central de notificações, com contador de não lidas e painel.
 *
 * Props:
 *   onAbrirDestino — callback(destino) ao clicar numa notificação; `destino` é o id da aba
 */
export function SinoNotificacoes({ onAbrirDestino }) {
  const [aberto, setAberto] = useState(false)
  const [filtro, setFiltro] = useState('todas')
  const [notificacoes, setNotificacoes] = useState([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const containerRef = useRef(null)
  const filtroRef = useRef(filtro)

  function aplicar(dados) {
    setNotificacoes(dados.resultados)
    setNaoLidas(dados.nao_lidas)
    setErro('')
  }

  async function carregar() {
    try {
      aplicar(await buscarNotificacoes(filtroRef.current))
    } catch (error) {
      setErro(error.message || 'Falha ao conectar ao servidor.')
    }
  }

  // Atualiza o contador periodicamente, mesmo com o painel fechado.
  useEffect(() => {
    let ativo = true

    async function atualizar() {
      try {
        const dados = await buscarNotificacoes(filtroRef.current)
        if (ativo) aplicar(dados)
      } catch (error) {
        if (ativo) setErro(error.message || 'Falha ao conectar ao servidor.')
      }
    }

    atualizar()
    const timer = setInterval(atualizar, INTERVALO_ATUALIZACAO)
    return () => {
      ativo = false
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!aberto) return undefined

    function aoClicarFora(evento) {
      if (!containerRef.current?.contains(evento.target)) setAberto(false)
    }
    function aoTeclar(evento) {
      if (evento.key === 'Escape') setAberto(false)
    }

    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  async function abrirPainel() {
    const abrir = !aberto
    setAberto(abrir)
    if (abrir) {
      setCarregando(true)
      await carregar()
      setCarregando(false)
    }
  }

  async function trocarFiltro(novo) {
    if (novo === filtro) return
    filtroRef.current = novo
    setFiltro(novo)
    setCarregando(true)
    await carregar()
    setCarregando(false)
  }

  async function abrirNotificacao(notificacao) {
    if (!notificacao.lida_em) {
      const lidaEm = new Date().toISOString()
      setNotificacoes((atuais) =>
        filtro === 'nao_lidas'
          ? atuais.filter((item) => item.id !== notificacao.id)
          : atuais.map((item) => (item.id === notificacao.id ? { ...item, lida_em: lidaEm } : item))
      )
      setNaoLidas((total) => Math.max(total - 1, 0))
      notificacoesFetch(`/${notificacao.id}/ler/`, { method: 'POST' }).catch(() => {})
    }
    setAberto(false)
    if (notificacao.destino) onAbrirDestino?.(notificacao.destino)
  }

  async function marcarTodasComoLidas() {
    const response = await notificacoesFetch('/ler-todas/', { method: 'POST' }).catch(() => null)
    if (!response?.ok) {
      setErro('Não foi possível marcar as notificações como lidas.')
      return
    }
    await carregar()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={abrirPainel}
        aria-label={naoLidas ? `Notificações: ${naoLidas} não lidas` : 'Notificações'}
        aria-expanded={aberto}
        className="relative flex size-9 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <IconBell size={20} />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none font-bold text-white">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute top-11 right-0 z-40 flex max-h-[70vh] w-96 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-modal">
          <div className="flex items-center justify-between border-b border-[#f4f4f4] px-4 py-3">
            <h3 className="text-base font-bold text-gray-900">Notificações</h3>
            <button
              type="button"
              onClick={marcarTodasComoLidas}
              disabled={naoLidas === 0}
              className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-green-700 hover:underline disabled:cursor-default disabled:text-gray-300 disabled:no-underline"
            >
              Marcar todas como lidas
            </button>
          </div>

          <div className="flex gap-1 border-b border-[#f4f4f4] px-3 py-2">
            {FILTROS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => trocarFiltro(item.id)}
                className={`${ABA} ${
                  filtro === item.id
                    ? 'bg-green-50 text-green-800'
                    : 'bg-transparent text-gray-500 hover:bg-gray-50'
                }`}
              >
                {item.label}
                {item.id === 'nao_lidas' && naoLidas > 0 && ` (${naoLidas})`}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {carregando ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : erro ? (
              <p className="px-4 py-6 text-center text-sm text-red-600">{erro}</p>
            ) : notificacoes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                {filtro === 'nao_lidas'
                  ? 'Nenhuma notificação não lida.'
                  : 'Você ainda não tem notificações.'}
              </p>
            ) : (
              <ul className="list-none">
                {notificacoes.map((notificacao) => (
                  <li key={notificacao.id} className="border-b border-[#f8f8f8] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => abrirNotificacao(notificacao)}
                      className={`flex w-full cursor-pointer gap-3 border-0 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                        notificacao.lida_em ? 'bg-white' : 'bg-green-50/40'
                      }`}
                    >
                      <span
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${
                          notificacao.lida_em ? 'bg-gray-200' : COR_POR_TOM[notificacao.tom]
                        }`}
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span
                          className={`text-sm text-gray-900 ${notificacao.lida_em ? 'font-medium' : 'font-bold'}`}
                        >
                          {notificacao.titulo}
                        </span>
                        <span className="text-sm text-gray-600">{notificacao.mensagem}</span>
                        <span className="text-xs text-gray-400">
                          {formatarDataHora(notificacao.criada_em)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
