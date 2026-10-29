import { Button } from '../components'
import { CartaoAviso, MENSAGEM_AVISO } from './AcessoNegado'

export default function SemPermissao() {
  return (
    <CartaoAviso titulo="Sem permissão">
      <p className={MENSAGEM_AVISO}>Você não tem permissão para acessar esta página.</p>
      <Button variant="accent" onClick={() => window.history.back()}>
        Voltar
      </Button>
    </CartaoAviso>
  )
}
