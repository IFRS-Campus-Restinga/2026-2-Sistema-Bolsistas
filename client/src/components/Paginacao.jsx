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

const BOTAO =
  'h-8 min-w-8 cursor-pointer rounded-lg border px-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45'
const BOTAO_NORMAL = `${BOTAO} border-gray-200 bg-white text-gray-700 enabled:hover:bg-gray-50`
const BOTAO_ATUAL = `${BOTAO} border-if-green bg-if-green text-white enabled:hover:bg-if-green-dark`

export function Paginacao({ pagina, porPagina, totalItens, onMudar }) {
  const totalPaginas = Math.max(1, Math.ceil(totalItens / porPagina))
  const primeiro = (pagina - 1) * porPagina + 1
  const ultimo = Math.min(pagina * porPagina, totalItens)

  return (
    <nav
      className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500"
      aria-label="Paginação"
    >
      <span>
        Mostrando {primeiro} a {ultimo} de {totalItens}
      </span>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className={BOTAO_NORMAL}
          onClick={() => onMudar(pagina - 1)}
          disabled={pagina === 1}
        >
          Anterior
        </button>

        {paginasVisiveis(pagina, totalPaginas).map((item, i) =>
          item === '…' ? (
            <span key={`reticencias-${i}`} className="px-1 text-gray-400">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={item === pagina ? BOTAO_ATUAL : BOTAO_NORMAL}
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
          className={BOTAO_NORMAL}
          onClick={() => onMudar(pagina + 1)}
          disabled={pagina === totalPaginas}
        >
          Próxima
        </button>
      </div>
    </nav>
  )
}
