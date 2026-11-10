// Evento que abre o sino de notificações direto numa aba, de qualquer tela.
const EVENTO = 'sino-notificacoes:abrir'

export function abrirSinoNotificacoes(aba) {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { aba } }))
}

export function aoPedirAbrirSino(callback) {
  const ouvinte = (evento) => callback(evento.detail.aba)
  window.addEventListener(EVENTO, ouvinte)
  return () => window.removeEventListener(EVENTO, ouvinte)
}
