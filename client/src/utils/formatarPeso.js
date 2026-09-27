export function formatarPeso(valor) {
  if (valor === null || valor === undefined || valor === '') return '—'
  return `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}
