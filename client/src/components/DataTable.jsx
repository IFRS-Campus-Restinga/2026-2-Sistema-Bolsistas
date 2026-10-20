import { useState } from 'react'
import { Paginacao } from './Paginacao'
import { useCarregamentoVisivel } from './useCarregamentoVisivel'
import './DataTable.css'

const LINHAS_ESQUELETO = 4
const LARGURAS_ESQUELETO = ['70%', '55%', '80%', '60%']

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
    return <div className="data-table__aguardando" role="status" aria-busy="true" />
  }

  if (mostrarEsqueleto) {
    return (
      <div className="data-table__wrapper" role="status" aria-busy="true" aria-label="Carregando">
        <table className="data-table">
          <thead>
            <tr className="data-table__header-row">
              {columns.map((col, i) => (
                <th key={i} className="data-table__th">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: LINHAS_ESQUELETO }, (_, i) => (
              <tr key={i} className="data-table__row">
                {columns.map((_, j) => (
                  <td key={j} className="data-table__td">
                    <span
                      className="data-table__esqueleto"
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
      <div className="data-table__empty">
        <div className="data-table__empty-icon">
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
        <p className="data-table__empty-text">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      <div className="data-table__wrapper">
        <table className="data-table">
          <thead>
            <tr className="data-table__header-row">
              {columns.map((col, i) => (
                <th key={i} className="data-table__th">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhasVisiveis.map((row, i) => (
              <tr key={i} className="data-table__row">
                {row.map((cell, j) => (
                  <td key={j} className="data-table__td">
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
