function doisDigitos(numero) {
  return String(numero).padStart(2, '0')
}

// Mês do backend ("2026-10"), no mesmo formato do <input type="month">.
export function mesAtual() {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${doisDigitos(hoje.getMonth() + 1)}`
}

export function formatarMes(mes) {
  if (!mes) return ''
  const [ano, numero] = mes.split('-')
  return `${numero}/${ano}`
}
