import { Spinner } from './Spinner'
import { useCarregamentoVisivel } from './useCarregamentoVisivel'
import './Spinner.css'

/**
 * Estado de carregamento de uma página, seção ou modal.
 * Só aparece se o carregamento passar de 300ms.
 *
 * Uso: {carregando ? <Carregando texto="Carregando projeto..." /> : conteúdo}
 */
export function Carregando({ texto = 'Carregando...' }) {
  const visivel = useCarregamentoVisivel(true)

  return (
    <div className="carregando" role="status" aria-busy="true" aria-label={texto}>
      {visivel && (
        <>
          <Spinner size={20} />
          <span>{texto}</span>
        </>
      )}
    </div>
  )
}
