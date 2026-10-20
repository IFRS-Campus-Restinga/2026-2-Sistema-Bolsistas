import './Paginacao.css'

const MAX_PAGINAS_SEM_RETICENCIAS = 7

function paginasVisiveis(atual, total) {
  if (total <= MAX_PAGINAS_SEM_RETICENCIAS) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const numeros = [...new Set([1, total, atual - 1, atual, atual + 1])]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b)

  return numeros.flatMap((n, i) => (i > 0 && n - numeros[i - 1] > 1 ? ['…', n] : [n]))
}

export function Paginacao({ pagina, porPagina, totalItens, onMudar }) {
  const totalPaginas = Math.max(1, Math.ceil(totalItens / porPagina))
  const primeiro = (pagina - 1) * porPagina + 1
  const ultimo = Math.min(pagina * porPagina, totalItens)

  return (
    <nav className="paginacao" aria-label="Paginação">
      <span className="paginacao__resumo">
        Mostrando {primeiro} a {ultimo} de {totalItens}
      </span>

      <div className="paginacao__controles">
        <button
          type="button"
          className="paginacao__botao"
          onClick={() => onMudar(pagina - 1)}
          disabled={pagina === 1}
        >
          Anterior
        </button>

        {paginasVisiveis(pagina, totalPaginas).map((item, i) =>
          item === '…' ? (
            <span key={`reticencias-${i}`} className="paginacao__reticencias">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`paginacao__botao${item === pagina ? ' paginacao__botao--atual' : ''}`}
              onClick={() => onMudar(item)}
              aria-current={item === pagina ? 'page' : undefined}
              aria-label={`Página ${item}`}
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          className="paginacao__botao"
          onClick={() => onMudar(pagina + 1)}
          disabled={pagina === totalPaginas}
        >
          Próxima
        </button>
      </div>
    </nav>
  )
}
