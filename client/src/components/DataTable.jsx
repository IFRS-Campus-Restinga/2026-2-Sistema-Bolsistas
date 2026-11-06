import { useState } from 'react'
import { Paginacao } from './Paginacao'
import { useCarregamentoVisivel } from './useCarregamentoVisivel'

const LINHAS_ESQUELETO = 4
const LARGURAS_ESQUELETO = ['70%', '55%', '80%', '60%']

const CAIXA = 'rounded-2xl border border-gray-100 bg-white shadow-card'
const WRAPPER = `${CAIXA} overflow-x-auto overflow-y-hidden`
const TABELA = 'w-full border-collapse text-base'
const LINHA =
  'border-b border-[#f8f8f8] transition-colors duration-100 ease-[ease] last:border-b-0 hover:bg-green-50/30'
const CELULA = 'px-5 py-3.5 text-center align-middle text-gray-700'

function Cabecalho({ columns }) {
  return (
    <thead>
      <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
        {columns.map((col, i) => (
          <th
            key={i}
            className="px-5 py-3 text-center text-[10px] font-bold tracking-widest whitespace-nowrap text-gray-400 uppercase"
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  )
}

/**
 * Tabela de dados genérica — suporta ReactNode nas células (badges, botões).
 *
 * Props:
 *   columns      — ["Nome", "E-mail", "Status", ...]
 *   rows         — [[cell, cell, ...], ...]  (cada cell pode ser string ou ReactNode)
 *   emptyMessage — texto quando não há registros
 *   loading      — mostra linhas-esqueleto enquanto os dados carregam
 *   porPagina    — linhas por página (padrão 10); null desliga a paginação
 */
export function DataTable({
  columns,
  rows,
  emptyMessage = 'Nenhum registro encontrado.',
  loading = false,
  porPagina = 10,
}) {
  const mostrarEsqueleto = useCarregamentoVisivel(loading)

  // A página só volta para 1 quando a tabela passa a mostrar outro tipo de dado
  const assinatura = columns.join('|')
  const [paginacao, setPaginacao] = useState({ pagina: 1, assinatura })
  const paginar = Boolean(porPagina) && rows.length > porPagina
  const totalPaginas = paginar ? Math.ceil(rows.length / porPagina) : 1
  const paginaSalva = paginacao.assinatura === assinatura ? paginacao.pagina : 1
  const pagina = Math.min(paginaSalva, totalPaginas)
  const linhasVisiveis = paginar ? rows.slice((pagina - 1) * porPagina, pagina * porPagina) : rows

  if (loading && !mostrarEsqueleto) {
    return <div className="min-h-30" role="status" aria-busy="true" />
  }

  if (mostrarEsqueleto) {
    return (
      <div className={WRAPPER} role="status" aria-busy="true" aria-label="Carregando">
        <table className={TABELA}>
          <Cabecalho columns={columns} />
          <tbody>
            {Array.from({ length: LINHAS_ESQUELETO }, (_, i) => (
              <tr key={i} className={LINHA}>
                {columns.map((_, j) => (
                  <td key={j} className={CELULA}>
                    <span
                      className="inline-block h-3 animate-brilho rounded-md bg-[linear-gradient(90deg,#f3f4f6_25%,#e5e7eb_37%,#f3f4f6_63%)] bg-size-[400%_100%] motion-reduce:animate-none"
                      style={{ width: LARGURAS_ESQUELETO[(i + j) % LARGURAS_ESQUELETO.length] }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={`${CAIXA} p-12 text-center`}>
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-gray-100">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <p className="text-base font-medium text-gray-400">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      <div className={WRAPPER}>
        <table className={TABELA}>
          <Cabecalho columns={columns} />
          <tbody>
            {linhasVisiveis.map((row, i) => (
              <tr key={i} className={LINHA}>
                {row.map((cell, j) => (
                  <td key={j} className={CELULA}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginar && (
        <Paginacao
          pagina={pagina}
          porPagina={porPagina}
          totalItens={rows.length}
          onMudar={(nova) => setPaginacao({ pagina: nova, assinatura })}
        />
      )}
    </>
  )
}
