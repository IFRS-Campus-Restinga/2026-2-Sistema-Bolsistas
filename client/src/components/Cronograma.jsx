import { formatarData } from '../utils/dataHora'

/**
 * Fases do edital (inscrições, homologação, recursos, resultado e vigência) em barras,
 * como no protótipo. `atual` vem do servidor: as anteriores ficam verdes e a atual escura.
 *
 * Props:
 *   fases   — [{ rotulo, fim }] com `fim` em "AAAA-MM-DD"
 *   atual   — índice da fase em andamento (fases.length quando todas terminaram)
 *   compact — esconde as datas
 */
export function Cronograma({ fases, atual, compact = false }) {
  return (
    <ol className="m-0 grid list-none grid-cols-5 gap-1.5 p-0">
      {fases.map((fase, indice) => {
        const feita = indice < atual
        const ativa = indice === atual
        return (
          <li key={fase.rotulo} className="min-w-0">
            <div
              className={`h-1 rounded-full ${feita ? 'bg-brand' : ativa ? 'bg-gray-900' : 'bg-gray-200'}`}
            />
            <div
              className={`mt-1.5 truncate text-2xs ${ativa ? 'font-medium text-gray-900' : 'text-gray-500'}`}
            >
              {fase.rotulo}
            </div>
            {!compact && fase.fim && (
              <div className="truncate text-2xs text-gray-400 tabular-nums">
                até {formatarData(fase.fim)}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
