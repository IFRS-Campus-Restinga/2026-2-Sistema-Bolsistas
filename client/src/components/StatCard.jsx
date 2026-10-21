/**
 * Card de estatística para dashboards.
 *
 * Props:
 *   label     — rótulo superior ("EDITAIS ATIVOS")
 *   value     — valor numérico ou texto
 *   detail    — linha de contexto abaixo do valor ("de 10 vagas"), opcional
 *   icon      — ReactNode do ícone
 *   color     — "green" | "purple" | "blue" | "orange" | "red"
 *   clickable — se mostra indicação de clicável no hover
 */
const CORES = {
  green: { borda: 'border-t-if-green', icone: 'bg-green-100 text-green-600' },
  purple: { borda: 'border-t-purple-600', icone: 'bg-purple-100 text-purple-600' },
  blue: { borda: 'border-t-blue-600', icone: 'bg-blue-100 text-blue-600' },
  orange: { borda: 'border-t-orange-600', icone: 'bg-orange-100 text-orange-600' },
  red: { borda: 'border-t-red-600', icone: 'bg-red-100 text-red-600' },
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  color = 'green',
  clickable = false,
  onClick,
}) {
  const clicavel = clickable || !!onClick
  const cores = CORES[color] ?? CORES.green

  return (
    <div
      className={`relative flex items-center justify-between gap-3 rounded-2xl border border-t-2 border-gray-100 bg-white p-5 shadow-card transition-all duration-200 ease-[ease] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] ${cores.borda} ${clicavel ? 'group cursor-pointer hover:-translate-y-0.5' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (evento) => {
              if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <div className="min-w-0">
        <p className="mb-2 truncate text-2xs font-semibold tracking-wider text-gray-400 uppercase">
          {label}
        </p>
        <p className="text-4xl leading-none font-extrabold tracking-tight text-gray-900">{value}</p>
        {detail && <p className="mt-1.5 text-sm text-gray-500">{detail}</p>}
      </div>
      <div
        className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${cores.icone}`}
      >
        {icon}
      </div>
      {clicavel && (
        <span className="absolute bottom-2.5 left-5 text-2xs font-semibold text-if-green opacity-0 transition-opacity duration-200 ease-[ease] select-none group-hover:opacity-100">
          Ir para →
        </span>
      )}
    </div>
  )
}
