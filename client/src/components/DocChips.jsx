import { useState } from 'react'
import { StatusPill } from './Badge'
import { DocumentViewer } from './DocumentViewer'
import { IconFileText } from './Icons'

/**
 * Documentos do aluno em chips com a decisão de cada um e, abaixo, o motivo dos
 * recusados. Clicar abre o documento no visualizador, só para leitura.
 *
 * Props:
 *   docs — no formato do DocumentViewer (ver utils/documentos.js)
 */
export function DocChips({ docs }) {
  const [aberto, setAberto] = useState(null)
  if (docs.length === 0) return null
  const recusados = docs.filter((doc) => doc.decision === 'REJEITADO' && doc.motivoRecusa)

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {docs.map((doc) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => setAberto(doc.id)}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            <IconFileText size={14} className="text-gray-400" />
            {doc.label}
            {doc.decision && (
              <StatusPill status={doc.decision} label={doc.decisionLabel} size="sm" />
            )}
          </button>
        ))}
      </div>
      {recusados.map((doc) => (
        <p key={doc.id} className="mt-2 text-xs text-red-600">
          Motivo{recusados.length > 1 ? ` (${doc.label})` : ''}: {doc.motivoRecusa}
        </p>
      ))}
      {aberto && <DocumentViewer docs={docs} initialId={aberto} onClose={() => setAberto(null)} />}
    </>
  )
}
