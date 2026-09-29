import { Button } from '../components'
import { HUB_FRONTEND } from '../api'
import './AcessoNegado.css'

export default function AcessoNegado({ mensagem }) {
  return (
    <div className="acesso-negado">
      <div className="acesso-negado__card">
        <h1 className="acesso-negado__title">Acesso negado</h1>
        <p className="acesso-negado__message">
          {mensagem}
          <br />
          Acesse este sistema a partir do HUB ou tente novamente.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <Button variant="accent" onClick={() => (window.location.href = HUB_FRONTEND)}>
            Ir ao HUB
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            Voltar
          </Button>
        </div>
      </div>
    </div>
  )
}
