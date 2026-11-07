import { Spinner } from './Spinner'
import { useCarregamentoVisivel } from './useCarregamentoVisivel'

const BASE =
  'inline-flex cursor-pointer items-center rounded-controle leading-none font-medium whitespace-nowrap transition-colors duration-150 ease-[ease] disabled:cursor-not-allowed disabled:opacity-50 aria-busy:disabled:cursor-progress aria-busy:disabled:opacity-85'

const TAMANHOS = {
  sm: 'h-7 gap-1 px-2.5 text-xs',
  md: 'h-8 gap-1.5 px-3 text-sm',
}

// Variantes do protótipo: neutras e discretas; o verde IF fica para a ação principal.
const VARIANTES = {
  primary: 'border-0 bg-gray-900 text-white shadow-xs enabled:hover:bg-gray-800',
  accent: 'border-0 bg-brand text-white shadow-xs enabled:hover:bg-brand-dark',
  outline:
    'border border-gray-200 bg-white text-gray-700 shadow-[0_1px_1px_rgb(0_0_0/0.03)] enabled:hover:border-gray-300 enabled:hover:bg-gray-50',
  danger: 'border border-red-200 bg-white text-red-600 enabled:hover:bg-red-50',
  ghost:
    'border-0 bg-transparent text-gray-600 enabled:hover:bg-gray-100 enabled:hover:text-gray-900',
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
