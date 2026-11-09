import { IconFileText } from './Icons'

/**
 * Estado vazio com ícone, título, orientação e ação opcional.
 *
 * Props:
 *   compact — menos espaço vertical, para dentro de cards e abas
 *
 * Uso:
 *   <EmptyState
 *     title="Nenhuma bolsa finalizada ainda"
 *     description="As bolsas aparecem aqui depois que o coordenador do projeto as finaliza."
 *   />
 */
export function EmptyState({ icon, title, description, action, compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-card border border-dashed border-gray-200 bg-white text-center ${compact ? 'px-6 py-8' : 'px-6 py-14'}`}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-400">
        {icon ?? <IconFileText />}
      </div>
      <p className="text-base font-medium text-gray-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
