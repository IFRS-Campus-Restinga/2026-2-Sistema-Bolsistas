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

// Data pura do backend ("2026-10-21"): só reorganiza o texto, sem passar por fuso horário.
export function formatarData(dataIso) {
  if (!dataIso) return ''
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}
