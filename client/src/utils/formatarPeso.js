/** Formata um peso em % no padrão brasileiro: "40%", "33,33%", ou "—" se vazio. */
export function formatarPeso(valor) {
  if (valor === null || valor === undefined || valor === '') return '—'
  return `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}
