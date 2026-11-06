import { useSyncExternalStore } from 'react'
import { observarRequisicoes, totalRequisicoesEmAndamento } from '../api'
import { useCarregamentoVisivel } from './useCarregamentoVisivel'

/**
 * Barra fina no topo da tela, visível enquanto houver requisições à API em
 * andamento por mais de 300ms. Não bloqueia a interação.
 */
export function BarraProgresso() {
  const pendentes = useSyncExternalStore(observarRequisicoes, totalRequisicoesEmAndamento)
  const visivel = useCarregamentoVisivel(pendentes > 0)

  if (!visivel) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[2000] h-[3px] overflow-hidden bg-if-green/15"
      role="progressbar"
      aria-label="Carregando"
    >
      <div className="h-full w-2/5 animate-deslizar bg-[linear-gradient(90deg,var(--color-if-green-dark),var(--color-if-green))] motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60" />
    </div>
  )
}
