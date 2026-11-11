import { StatusPill } from './Badge'
import { IconFileText } from './Icons'

/**
 * Lista de documentos enviados; clicar abre o documento no DocumentViewer.
 *
 * Props:
 *   docs   — no formato do DocumentViewer (ver utils/documentos.js)
 *   onOpen — recebe o id do documento clicado
 */
export function DocList({ docs, onOpen }) {
  if (docs.length === 0) return <p className="text-sm text-gray-400">Nenhum documento enviado.</p>

  return (
    <ul className="m-0 list-none divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 p-0">
      {docs.map((doc) => (
        <li key={doc.id}>
          <button
            type="button"
            onClick={() => onOpen(doc.id)}
            className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3 py-2.5 text-left hover:bg-gray-50"
          >
            <IconFileText size={16} className="text-gray-400" />
            <span className="min-w-0 flex-1 text-sm text-gray-800">
              {doc.label}
              <span className="block truncate text-xs text-gray-400">{doc.fileName}</span>
            </span>
            {doc.decision && (
              <StatusPill status={doc.decision} label={doc.decisionLabel} size="sm" />
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
