import { IconChevronRight } from './Icons'

/**
 * Card de indicador para os painéis iniciais.
 *
 * Props:
 *   label     — rótulo do indicador ("Bolsas ofertadas")
 *   value     — valor numérico ou texto
 *   detail    — linha de contexto abaixo do valor ("de 10 vagas"), opcional
 *   icon      — ReactNode do ícone
 *   color     — "green" | "purple" | "blue" | "orange" | "red" | "gray" (cor do ícone)
 *   clickable — mostra a seta de navegação; implícito quando há onClick
 */
const CORES_DO_ICONE = {
  green: 'bg-brand-soft text-brand',
  purple: 'bg-violet-50 text-violet-600',
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-gray-100 text-gray-600',
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
  const Elemento = onClick ? 'button' : 'div'

  return (
    <Elemento
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`group relative flex h-full w-full flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 text-left leading-[inherit] shadow-card transition-all duration-150 ease-[ease] ${clicavel ? 'cursor-pointer hover:border-gray-300 hover:shadow-card-hover' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-gray-500">{label}</span>
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-4 ${CORES_DO_ICONE[color] ?? CORES_DO_ICONE.green}`}
        >
          {icon}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-[28px] leading-none font-semibold tracking-tight text-gray-900 tabular-nums">
          {value}
        </span>
        {clicavel && (
          <IconChevronRight
            size={16}
            className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500"
          />
        )}
      </div>
      {detail && <span className="text-xs text-gray-500">{detail}</span>}
    </Elemento>
  )
}
