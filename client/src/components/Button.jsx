import './Button.css'

/**
 * Botão reutilizável com variantes de estilo.
 *
 * Props:
 *   variant   — "primary" | "accent" | "outline" | "danger" | "ghost"
 *   size      — "sm" | "md"
 *   onClick, type, disabled, className, children
 */
export function Button({
  children,
  variant = 'outline',
  size = 'md',
  onClick,
  type = 'button',
  disabled,
  className = '',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn btn--${variant} btn--${size} ${className}`}
    >
      {children}
    </button>
  )
}
