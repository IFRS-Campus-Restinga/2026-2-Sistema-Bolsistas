/**
 * Superfície branca com borda e sombra leve, base dos painéis do sistema.
 *
 * Props:
 *   padded    — padding interno padrão (false para listas que encostam na borda)
 *   onClick   — torna o card clicável (vira <button>, com hover)
 *   selected  — destaca o card escolhido (ex.: bolsa selecionada numa lista de cards)
 *
 * Uso: <Card onClick={() => abrir(bolsa)} selected={bolsa.id === atual}>...</Card>
 */
export function Card({ children, className = '', padded = true, onClick, selected = false }) {
  const Elemento = onClick ? 'button' : 'div'
  const borda = selected ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200'
  const clicavel = onClick
    ? 'cursor-pointer enabled:hover:border-gray-300 enabled:hover:shadow-card-hover'
    : ''

  return (
    <Elemento
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`block w-full rounded-card border bg-white text-left leading-[inherit] shadow-card transition-all ${padded ? 'p-5' : ''} ${borda} ${clicavel} ${className}`}
    >
      {children}
    </Elemento>
  )
}
