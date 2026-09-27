/**
 * Conversões entre o valor de um <input type="datetime-local"> (hora local do
 * navegador, sem fuso: "2026-10-05T14:00") e o ISO com fuso que a API usa.
 */

function doisDigitos(numero) {
  return String(numero).padStart(2, '0')
}

export function isoParaInputLocal(iso) {
  if (!iso) return ''
  const data = new Date(iso)
  return (
    `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}` +
    `T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
  )
}

export function inputLocalParaIso(valor) {
  return valor ? new Date(valor).toISOString() : null
}

export function formatarDataHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
