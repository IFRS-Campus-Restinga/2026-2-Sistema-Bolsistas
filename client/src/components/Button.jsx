import { Spinner } from './Spinner'
import { useCarregamentoVisivel } from './useCarregamentoVisivel'

const BASE =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-xl leading-none font-semibold whitespace-nowrap transition-all duration-150 ease-[ease] disabled:cursor-not-allowed disabled:opacity-50 aria-busy:disabled:cursor-progress aria-busy:disabled:opacity-85'

const TAMANHOS = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-base',
}

const VARIANTES = {
  primary: 'border-0 bg-gray-900 text-white shadow-xs enabled:hover:bg-gray-800',
  accent:
    'border-0 bg-[linear-gradient(135deg,var(--color-if-green-dark),var(--color-if-green))] text-white shadow-[0_2px_8px_rgba(47,158,65,0.25)] enabled:hover:brightness-90',
  outline: 'border border-gray-200 bg-white text-gray-700 shadow-xs enabled:hover:bg-gray-50',
  danger:
    'border-0 bg-if-red text-white shadow-[0_2px_8px_rgba(205,25,30,0.25)] enabled:hover:brightness-90',
  ghost: 'border-0 bg-transparent text-gray-600 enabled:hover:bg-gray-100',
}

/**
 * Botão reutilizável com variantes de estilo.
 *
 * Props:
 *   variant   — "primary" | "accent" | "outline" | "danger" | "ghost"
 *   size      — "sm" | "md"
 *   loading   — desabilita na hora e mostra spinner se a ação passar de 300ms
 *   onClick, type, disabled, className, children
 */
export function Button({
  children,
  variant = 'outline',
  size = 'md',
  onClick,
  type = 'button',
  disabled,
  loading = false,
  className = '',
}) {
  const mostrarSpinner = useCarregamentoVisivel(loading)

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading || mostrarSpinner}
      aria-busy={loading || undefined}
      className={`${BASE} ${TAMANHOS[size]} ${VARIANTES[variant]} ${className}`}
    >
      {mostrarSpinner && <Spinner size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  )
}
