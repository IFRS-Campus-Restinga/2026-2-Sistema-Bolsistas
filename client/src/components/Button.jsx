import { Spinner } from './Spinner'
import { useCarregamentoVisivel } from './useCarregamentoVisivel'
import './Button.css'

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
      className={`btn btn--${variant} btn--${size} ${className}`}
    >
      {mostrarSpinner && <Spinner size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  )
}
