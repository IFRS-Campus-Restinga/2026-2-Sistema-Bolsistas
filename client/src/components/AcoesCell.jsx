/**
 * Célula de ações de uma linha de tabela — mostra os botões passados em
 * `children` quando `mostrar` é true, ou "Sem ações disponíveis" caso
 * contrário. Centraliza o texto/layout que antes estava duplicado (e
 * inconsistente) em cada página com tabela de status.
 *
 * Uso: <AcoesCell mostrar={bolsa.status === 'SOLICITADA'}><Button>Aprovar</Button></AcoesCell>
 */
export function AcoesCell({ mostrar, children }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {mostrar ? children : 'Sem ações disponíveis'}
    </div>
  )
}
