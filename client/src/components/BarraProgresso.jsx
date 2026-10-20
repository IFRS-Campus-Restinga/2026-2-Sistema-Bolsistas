import { useSyncExternalStore } from 'react'
import { observarRequisicoes, totalRequisicoesEmAndamento } from '../api'
import { useCarregamentoVisivel } from './useCarregamentoVisivel'
import './BarraProgresso.css'

/**
 * Barra fina no topo da tela, visível enquanto houver requisições à API em
 * andamento por mais de 300ms. Não bloqueia a interação.
 */
export function BarraProgresso() {
  const pendentes = useSyncExternalStore(observarRequisicoes, totalRequisicoesEmAndamento)
  const visivel = useCarregamentoVisivel(pendentes > 0)

  if (!visivel) return null

  return (
    <div className="barra-progresso" role="progressbar" aria-label="Carregando">
      <div className="barra-progresso__indicador" />
    </div>
  )
}
