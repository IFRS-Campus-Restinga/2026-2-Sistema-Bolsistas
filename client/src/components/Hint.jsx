import { IconInfoCircle } from './Icons'

/**
 * Texto de instrução discreto no topo de uma lista ou tabela.
 *
 * Uso: <Hint>Clique em uma ação ou entidade para filtrar a auditoria.</Hint>
 */
export function Hint({ children }) {
  return (
    <p className="mb-3 flex items-center gap-1.5 text-xs text-gray-500">
      <IconInfoCircle size={14} className="shrink-0 text-gray-400" />
      {children}
    </p>
  )
}
