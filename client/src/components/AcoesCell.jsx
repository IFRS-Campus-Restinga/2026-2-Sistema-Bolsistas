import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { IconDotsHorizontal } from './Icons'
import { Spinner } from './Spinner'
import { useCarregamentoVisivel } from './useCarregamentoVisivel'

const ALTURA_ESTIMADA_ITEM = 36

const CELULA = 'justify-center text-sm text-gray-400'

const ITEM =
  'flex cursor-pointer items-center rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm leading-[normal] font-medium enabled:hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Célula de ações de uma linha de tabela.
 *
 * - `mostrar` false, ou nenhuma ação: "Sem ações disponíveis".
 * - Uma ação só: botão normal.
 * - Duas ou mais: um botão "..." que abre um menu com as ações.
 *
 * Uso:
 *   <AcoesCell
 *     mostrar={bolsa.status === 'SOLICITADA'}
 *     acoes={[
 *       { label: 'Aprovar', variant: 'accent', onClick: () => aprovar(bolsa) },
 *       { label: 'Rejeitar', variant: 'danger', onClick: () => rejeitar(bolsa) },
 *     ]}
 *   />
 *
 * `ocupado` marca a linha como em processamento: desabilita as ações e mostra spinner.
 */
export function AcoesCell({ mostrar = true, acoes = [], ocupado = false }) {
  const mostrarSpinner = useCarregamentoVisivel(ocupado)
  const [aberto, setAberto] = useState(false)
  const [posicao, setPosicao] = useState(null)
  const gatilhoRef = useRef(null)
  const painelRef = useRef(null)

  useEffect(() => {
    if (!aberto) return undefined

    function aoClicarFora(evento) {
      const dentroDoGatilho = gatilhoRef.current?.contains(evento.target)
      const dentroDoPainel = painelRef.current?.contains(evento.target)
      if (!dentroDoGatilho && !dentroDoPainel) setAberto(false)
    }

    function aoRolar() {
      setAberto(false)
    }

    document.addEventListener('mousedown', aoClicarFora)
    window.addEventListener('scroll', aoRolar, true)
    window.addEventListener('resize', aoRolar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      window.removeEventListener('scroll', aoRolar, true)
      window.removeEventListener('resize', aoRolar)
    }
  }, [aberto])

  function alternarMenu() {
    if (aberto) {
      setAberto(false)
      return
    }

    const rect = gatilhoRef.current.getBoundingClientRect()
    const alturaEstimadaPainel = acoes.length * ALTURA_ESTIMADA_ITEM + 8
    const cabeAbaixo = window.innerHeight - rect.bottom >= alturaEstimadaPainel

    setPosicao({
      left: Math.max(8, rect.right - 160),
      top: cabeAbaixo ? rect.bottom + 4 : undefined,
      bottom: cabeAbaixo ? undefined : window.innerHeight - rect.top + 4,
    })
    setAberto(true)
  }

  if (!mostrar || acoes.length === 0) {
    return <div className={`flex ${CELULA}`}>Sem ações disponíveis</div>
  }

  if (acoes.length === 1) {
    const [acao] = acoes
    return (
      <div className={`flex ${CELULA}`}>
        <Button
          size="sm"
          variant={acao.variant || 'outline'}
          onClick={acao.onClick}
          disabled={acao.disabled}
          loading={ocupado}
        >
          {acao.label}
        </Button>
      </div>
    )
  }

  return (
    <div className={`relative inline-flex ${CELULA}`}>
      <button
        ref={gatilhoRef}
        type="button"
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-xl border-0 bg-transparent text-gray-600 transition-[background] duration-150 ease-[ease] enabled:hover:bg-gray-50 disabled:cursor-progress"
        onClick={alternarMenu}
        disabled={ocupado || mostrarSpinner}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-busy={ocupado || undefined}
        aria-label="Mais ações"
      >
        {mostrarSpinner ? <Spinner size={16} /> : <IconDotsHorizontal />}
      </button>

      {aberto &&
        posicao &&
        createPortal(
          <div
            ref={painelRef}
            className="fixed z-[1000] flex min-w-40 flex-col rounded-xl border border-gray-200 bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
            role="menu"
            style={posicao}
          >
            {acoes.map((acao) => (
              <button
                key={acao.label}
                type="button"
                role="menuitem"
                className={`${ITEM} ${acao.variant === 'danger' ? 'text-if-red' : 'text-gray-700'}`}
                disabled={acao.disabled}
                onClick={() => {
                  setAberto(false)
                  acao.onClick()
                }}
              >
                {acao.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}
