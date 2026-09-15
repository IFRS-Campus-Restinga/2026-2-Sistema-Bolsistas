import { Button } from '../components'
import './AcessoNegado.css'

export default function AcessoNegado({ mensagem }) {
  return (
    <div className="acesso-negado">
      <div className="acesso-negado__card">
        <h1 className="acesso-negado__title">Acesso negado</h1>
        <p className="acesso-negado__message">
          {mensagem}
          <br />
          Você não está logado ou sua sessão expirou, por favor, faça login novamente via HUB.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <Button variant="accent" onClick={() => (window.location.href = 'http://localhost:3000')}>
            Ir ao HUB
          </Button>
        </div>
      </div>
    </div>
  )
}
