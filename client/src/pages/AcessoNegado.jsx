import { Button } from '../components'
import { HUB_FRONTEND } from '../api'

/** Tela cheia com um cartão centralizado; usada aqui e em SemPermissao. */
export function CartaoAviso({ titulo, children }) {
  return (
    <div className="flex h-screen items-center justify-center bg-fundo">
      <div className="w-full max-w-[400px] rounded-2xl border border-gray-100 bg-white px-10 py-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h1 className="mb-2 text-2xl font-extrabold text-gray-900">{titulo}</h1>
        {children}
      </div>
    </div>
  )
}

export const MENSAGEM_AVISO = 'mb-6 text-base text-gray-500'

export default function AcessoNegado({ mensagem }) {
  return (
    <CartaoAviso titulo="Acesso negado">
      <p className={MENSAGEM_AVISO}>
        {mensagem
          ? mensagem
          : 'Você não está logado ou sua sessão expirou, por favor, faça login novamente via HUB.'}
      </p>
      <div className="flex flex-col items-center gap-2.5">
        <Button variant="accent" onClick={() => (window.location.href = HUB_FRONTEND)}>
          Ir ao HUB
        </Button>
      </div>
    </CartaoAviso>
  )
}
