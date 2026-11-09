const PONTO_POR_TOM = {
  neutral: 'bg-gray-400',
  info: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
}

/**
 * Linha do tempo de eventos (histórico de prazos, decisões, intervenções).
 *
 * Cada item: { id, title, meta, tone?, body? }
 *   meta — quem e quando (ex.: "Carlos Lima · 01/11/2026 às 14:12")
 *   tone — "neutral" | "info" | "success" | "warning" | "danger" (cor do ponto)
 *   body — texto em destaque abaixo (ex.: justificativa)
 *
 * Uso: <Timeline items={historico} vazio="Nenhuma alteração de prazo." />
 */
export function Timeline({ items, vazio = 'Sem histórico.' }) {
  if (items.length === 0) return <p className="text-sm text-gray-400">{vazio}</p>

  return (
    <ol className="relative list-none">
      {items.map((item, indice) => (
        <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
          {indice < items.length - 1 && (
            <span className="absolute top-4 bottom-0 left-[5px] w-px bg-gray-200" />
          )}
          <span
            className={`relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-white ring-1 ring-gray-200 ${PONTO_POR_TOM[item.tone ?? 'neutral']}`}
          />
          <div className="min-w-0">
            <div className="text-sm text-gray-900">{item.title}</div>
            <div className="text-xs text-gray-500">{item.meta}</div>
            {item.body && (
              <div className="mt-1.5 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {item.body}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
