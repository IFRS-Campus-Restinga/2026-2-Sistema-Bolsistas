import { useEffect, useRef, useState } from 'react'

const ATRASO_MS = 300
const DURACAO_MINIMA_MS = 400

/**
 * Decide quando um indicador de carregamento deve aparecer.
 *
 * Ações rápidas (< 300ms) não mostram nada, evitando que o indicador pisque.
 * Uma vez exibido, ele fica pelo menos 400ms, para não virar um flash.
 */
export function useCarregamentoVisivel(ativo) {
  const [visivel, setVisivel] = useState(false)
  const exibidoEm = useRef(0)

  useEffect(() => {
    if (ativo) {
      const timer = setTimeout(() => {
        exibidoEm.current = Date.now()
        setVisivel(true)
      }, ATRASO_MS)
      return () => clearTimeout(timer)
    }

    const restante = Math.max(0, DURACAO_MINIMA_MS - (Date.now() - exibidoEm.current))
    const timer = setTimeout(() => setVisivel(false), restante)
    return () => clearTimeout(timer)
  }, [ativo])

  return visivel
}
