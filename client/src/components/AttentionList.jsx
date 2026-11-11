import { IconCheckCircle, IconChevronRight } from './Icons'

const COR_DO_PONTO = { warning: 'bg-amber-500', danger: 'bg-red-500', info: 'bg-blue-500' }

/**
 * Lista "Requer atenção" dos painéis: só os itens com contagem, cada um levando à tela
 * onde se resolve. Sem nenhum, mostra a mensagem de tudo em dia.
 *
 * Props:
 *   items     — [{ id, label, count, tone: 'warning' | 'danger' | 'info', onClick }]
 *   emptyText — mensagem quando nada está pendente
 */
export function AttentionList({ items, emptyText = 'Nada pendente. Tudo em dia.' }) {
  const visiveis = items.filter((item) => item.count > 0)

  if (visiveis.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50/60 px-3 py-3 text-sm text-emerald-800">
        <IconCheckCircle size={16} /> {emptyText}
      </div>
    )
  }

  return (
    <ul className="-mx-2 my-0 list-none p-0">
      {visiveis.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={item.onClick}
            className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-2 py-2 text-left hover:bg-gray-50"
          >
            <span className={`size-2 rounded-full ${COR_DO_PONTO[item.tone]}`} />
            <span className="flex-1 text-sm text-gray-700">{item.label}</span>
            <span className="text-sm font-semibold text-gray-900 tabular-nums">{item.count}</span>
            <IconChevronRight size={14} className="text-gray-300 group-hover:text-gray-500" />
          </button>
        </li>
      ))}
    </ul>
  )
}
