import { Button } from '../components'
import './AcessoNegado.css'

export default function SemPermissao() {
  return (
    <div className="acesso-negado">
      <div className="acesso-negado__card">
        <h1 className="acesso-negado__title">Sem permissão</h1>
        <p className="acesso-negado__message">Você não tem permissão para acessar esta página.</p>
        <Button variant="accent" onClick={() => window.history.back()}>
          Voltar
        </Button>
      </div>
    </div>
  )
}
