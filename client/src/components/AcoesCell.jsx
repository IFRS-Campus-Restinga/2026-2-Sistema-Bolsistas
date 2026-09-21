import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { IconDotsHorizontal } from './Icons'
import './AcoesCell.css'

const ALTURA_ESTIMADA_ITEM = 36

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
 */
export function AcoesCell({ mostrar = true, acoes = [] }) {
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
    return <div className="acoes-cell">Sem ações disponíveis</div>
  }

  if (acoes.length === 1) {
    const [acao] = acoes
    return (
      <div className="acoes-cell">
        <Button
          size="sm"
          variant={acao.variant || 'outline'}
          onClick={acao.onClick}
          disabled={acao.disabled}
        >
          {acao.label}
        </Button>
      </div>
    )
  }

  return (
    <div className="acoes-cell acoes-cell--menu">
      <button
        ref={gatilhoRef}
        type="button"
        className="acoes-cell__gatilho"
        onClick={alternarMenu}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Mais ações"
      >
        <IconDotsHorizontal />
      </button>

      {aberto &&
        posicao &&
        createPortal(
          <div ref={painelRef} className="acoes-cell__painel" role="menu" style={posicao}>
            {acoes.map((acao) => (
              <button
                key={acao.label}
                type="button"
                role="menuitem"
                className={`acoes-cell__item${acao.variant === 'danger' ? ' acoes-cell__item--danger' : ''}`}
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
