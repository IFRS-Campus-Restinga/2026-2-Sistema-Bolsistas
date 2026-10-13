// Junta as mensagens de erro do DRF (detail, campos e listas aninhadas) em um texto só.
export function mensagemDeErro(corpo, padrao) {
  if (corpo?.detail) return corpo.detail

  const mensagens = []
  const coletar = (valor) => {
    if (typeof valor === 'string') mensagens.push(valor)
    else if (Array.isArray(valor)) valor.forEach(coletar)
    else if (valor && typeof valor === 'object') Object.values(valor).forEach(coletar)
  }
  coletar(corpo)

  return mensagens.join(' ') || padrao
}
