import { useState } from 'react'
import { EmptyState } from './EmptyState'
import { IconSearch } from './Icons'
import { Paginacao } from './Paginacao'
import { useCarregamentoVisivel } from './useCarregamentoVisivel'

const LINHAS_ESQUELETO = 4
const LARGURAS_ESQUELETO = ['70%', '55%', '80%', '60%']

const WRAPPER =
  'overflow-x-auto overflow-y-hidden rounded-card border border-gray-200 bg-white shadow-card'
const TABELA = 'w-full border-collapse text-sm'
const LINHA =
  'border-b border-gray-100 transition-colors duration-100 ease-[ease] last:border-b-0 hover:bg-gray-50/70'
const CELULA = 'px-4 py-3 text-left align-middle text-gray-700'

function Cabecalho({ columns }) {
  return (
    <thead>
      <tr className="border-b border-gray-200 bg-gray-50/70">
        {columns.map((col, i) => (
          <th
            key={i}
            className="px-4 py-2.5 text-left text-xs font-medium whitespace-nowrap text-gray-500"
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
 *   onRowClick   — callback(índice da linha em `rows`) ao clicar numa linha
 */
export function DataTable({
  columns,
  rows,
  emptyMessage = 'Nenhum registro encontrado.',
  loading = false,
  porPagina = 10,
  onRowClick,
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
                      className="inline-block h-3 animate-brilho rounded-md bg-[linear-gradient(90deg,var(--color-gray-100)_25%,var(--color-gray-200)_37%,var(--color-gray-100)_63%)] bg-size-[400%_100%] motion-reduce:animate-none"
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
    return <EmptyState compact icon={<IconSearch />} title={emptyMessage} />
  }

  return (
    <>
      <div className={WRAPPER}>
        <table className={TABELA}>
          <Cabecalho columns={columns} />
          <tbody>
            {linhasVisiveis.map((row, i) => (
              <tr
                key={i}
                className={`${LINHA} ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={
                  onRowClick ? () => onRowClick((pagina - 1) * (porPagina || 0) + i) : undefined
                }
              >
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
