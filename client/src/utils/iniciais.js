// Iniciais do nome para o avatar ("Beatriz Nunes" → "BN"), ignorando etiquetas como "[dev]".
export function iniciais(nome) {
  const partes = (nome || '')
    .replace(/\[[^\]]*\]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}
