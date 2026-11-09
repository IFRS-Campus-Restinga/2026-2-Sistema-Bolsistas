/**
 * Abas para alternar entre visões de uma mesma página, com contador opcional.
 *
 * Uso:
 *   <Tabs
 *     value={aba}
 *     onChange={setAba}
 *     tabs={[
 *       { id: 'andamento', label: 'Em andamento', count: 3 },
 *       { id: 'finalizadas', label: 'Finalizadas' },
 *     ]}
 *   />
 */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-5 border-b border-gray-200" role="tablist">
      {tabs.map((aba) => {
        const ativa = value === aba.id
        return (
          <button
            key={aba.id}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => onChange(aba.id)}
            className={`-mb-px flex cursor-pointer items-center gap-1.5 border-0 border-b-2 border-solid bg-transparent px-0 pb-2.5 text-sm leading-[normal] font-medium transition-colors ${
              ativa
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {aba.label}
            {aba.count !== undefined && (
              <span
                className={`rounded-full px-1.5 text-2xs tabular-nums ${ativa ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
              >
                {aba.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
