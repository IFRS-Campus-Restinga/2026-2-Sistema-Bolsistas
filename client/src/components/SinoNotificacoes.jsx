import { useEffect, useRef, useState } from 'react'
import { notificacoesFetch } from '../api'
import { formatarDataHora } from '../utils/dataHora'
import { aoPedirAbrirSino } from '../utils/sinoNotificacoes'
import { IconBell } from './Icons'
import { PreferenciasPendencias } from './PreferenciasPendencias'
import { Spinner } from './Spinner'

const INTERVALO_ATUALIZACAO = 60_000

const COR_POR_TOM = {
  INFO: 'bg-blue-500',
  SUCESSO: 'bg-brand',
  AVISO: 'bg-amber-500',
  ERRO: 'bg-red-500',
}

const FILTROS = [
  { id: 'todas', label: 'Todas' },
  { id: 'nao_lidas', label: 'Não lidas' },
]

// Só para quem recebe avisos de pendência (administrador).
const ABA_CONFIGURAR = { id: 'configurar', label: 'Configurar' }

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
 *   onAbrirDestino — callback(destino) ao clicar numa notificação; `destino` é o id da tab
 */
export function SinoNotificacoes({ onAbrirDestino }) {
  const [aberto, setAberto] = useState(false)
  const [filtro, setFiltro] = useState('todas')
  const [notificacoes, setNotificacoes] = useState([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [configuravel, setConfiguravel] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const containerRef = useRef(null)
  const filtroRef = useRef(filtro)

  function aplicar(dados) {
    setNotificacoes(dados.resultados)
    setNaoLidas(dados.nao_lidas)
    setConfiguravel(Boolean(dados.configuravel))
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

  // Outras telas abrem o sino numa aba (ex.: o "Configurar" do painel do administrador).
  useEffect(
    () =>
      aoPedirAbrirSino((aba) => {
        if (aba !== ABA_CONFIGURAR.id) filtroRef.current = aba
        setFiltro(aba)
        setAberto(true)
      }),
    []
  )

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
    setFiltro(novo)
    if (novo === ABA_CONFIGURAR.id) return
    filtroRef.current = novo
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
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className={`relative flex size-9 cursor-pointer items-center justify-center rounded-controle border-0 leading-[normal] transition-colors ${aberto ? 'bg-gray-100 text-gray-900' : 'bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
      >
        <IconBell size={18} />
        {naoLidas > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none font-semibold text-white tabular-nums ring-2 ring-white">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Notificações"
          className="absolute top-11 right-0 z-40 flex max-h-[70vh] w-96 animate-aparecer flex-col overflow-hidden rounded-card border border-gray-200 bg-white shadow-pop"
        >
          <div className="flex items-center justify-between px-4 pt-3">
            <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
            <button
              type="button"
              onClick={marcarTodasComoLidas}
              disabled={naoLidas === 0}
              className="cursor-pointer border-0 bg-transparent p-0 text-xs leading-[normal] font-medium text-gray-500 hover:text-gray-900 disabled:cursor-default disabled:text-gray-300"
            >
              Marcar todas como lidas
            </button>
          </div>

          <div className="mt-2 flex gap-4 border-b border-gray-200 px-4" role="tablist">
            {(configuravel ? [...FILTROS, ABA_CONFIGURAR] : FILTROS).map((item) => {
              const ativo = filtro === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  onClick={() => trocarFiltro(item.id)}
                  className={`-mb-px flex cursor-pointer items-center gap-1.5 border-0 border-b-2 border-solid bg-transparent px-0 pb-2 text-sm leading-[normal] font-medium transition-colors ${
                    ativo
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {item.label}
                  {item.id === 'nao_lidas' && naoLidas > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-2xs tabular-nums ${ativo ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {naoLidas}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtro === ABA_CONFIGURAR.id ? (
              <PreferenciasPendencias />
            ) : carregando ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : erro ? (
              <p className="px-4 py-8 text-center text-sm text-red-600">{erro}</p>
            ) : notificacoes.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-400">
                  <IconBell size={18} />
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {filtro === 'nao_lidas' ? 'Tudo em dia' : 'Nenhuma notificação'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {filtro === 'nao_lidas'
                    ? 'Você não tem notificações não lidas.'
                    : 'Os avisos do sistema aparecem aqui.'}
                </p>
              </div>
            ) : (
              <ul className="m-0 list-none p-0">
                {notificacoes.map((notificacao) => {
                  const lida = Boolean(notificacao.lida_em)
                  return (
                    <li key={notificacao.id} className="border-b border-gray-100 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => abrirNotificacao(notificacao)}
                        className={`flex w-full cursor-pointer gap-3 border-0 px-4 py-3 text-left leading-[normal] transition-colors hover:bg-gray-50 ${lida ? 'bg-white' : 'bg-gray-50/60'}`}
                      >
                        <span
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${lida ? 'bg-gray-200' : COR_POR_TOM[notificacao.tom]}`}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span
                            className={`text-sm ${lida ? 'text-gray-600' : 'font-medium text-gray-900'}`}
                          >
                            {notificacao.titulo}
                          </span>
                          <span className="text-xs leading-normal text-gray-500">
                            {notificacao.mensagem}
                          </span>
                          <span className="mt-0.5 text-2xs text-gray-400 tabular-nums">
                            {formatarDataHora(notificacao.criada_em)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
