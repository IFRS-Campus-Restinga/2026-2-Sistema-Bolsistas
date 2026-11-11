/**
 * Faixa de destaque no topo da página (chamada para ação, aviso).
 *
 * Props:
 *   tone — "neutral" (padrão) | "warning" (algo pendente do usuário)
 */
export function Banner({ title, description, action, tone = 'neutral' }) {
  const cores = tone === 'warning' ? 'border-amber-200 bg-amber-50/70' : 'border-gray-200 bg-white'

  return (
    <div
      className={`mb-6 flex flex-wrap items-center justify-between gap-4 rounded-card border p-5 shadow-card ${cores}`}
    >
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-sm text-gray-500">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
