export function formatarMoeda(valor) {
  if (valor === null || valor === undefined || valor === '') return 'Não informado'
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
