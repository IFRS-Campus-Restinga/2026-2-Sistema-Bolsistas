/**
 * Indicador de carregamento circular. Herda a cor do texto (currentColor).
 *
 * Uso: <Spinner size={16} />
 */
export function Spinner({ size = 16 }) {
  return (
    <svg
      className="shrink-0 animate-girar motion-reduce:[animation-duration:1.6s]"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
