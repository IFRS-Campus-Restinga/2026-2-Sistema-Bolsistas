import './DataTable.css'

/**
 * Tabela de dados genérica — suporta ReactNode nas células (badges, botões).
 *
 * Props:
 *   columns      — ["Nome", "E-mail", "Status", ...]
 *   rows         — [[cell, cell, ...], ...]  (cada cell pode ser string ou ReactNode)
 *   emptyMessage — texto quando não há registros
 */
export function DataTable({ columns, rows, emptyMessage = 'Nenhum registro encontrado.' }) {
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
          {rows.map((row, i) => (
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
  )
}
