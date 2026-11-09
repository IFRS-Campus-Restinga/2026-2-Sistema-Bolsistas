import { IconCheck } from './Icons'

/**
 * Progresso de um fluxo em etapas (inscrição, seleção de candidatos...).
 * Etapas antes de `current` aparecem concluídas; `current` é a etapa atual (índice 0).
 *
 * Uso: <Stepper steps={['Homologação', 'Recursos', 'Notas', 'Resultado']} current={1} />
 */
export function Stepper({ steps, current }) {
  return (
    <ol className="flex list-none items-center gap-2">
      {steps.map((etapa, indice) => {
        const concluida = indice < current
        const atual = indice === current
        return (
          <li
            key={indice}
            className="flex min-w-0 flex-1 items-center gap-2"
            aria-current={atual ? 'step' : undefined}
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ${
                concluida
                  ? 'bg-brand text-white'
                  : atual
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {concluida ? <IconCheck size={12} /> : indice + 1}
            </span>
            <span
              className={`truncate text-xs ${atual ? 'font-medium text-gray-900' : concluida ? 'text-gray-600' : 'text-gray-400'}`}
            >
              {etapa}
            </span>
            {indice < steps.length - 1 && (
              <span className={`h-px flex-1 ${concluida ? 'bg-brand' : 'bg-gray-200'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
