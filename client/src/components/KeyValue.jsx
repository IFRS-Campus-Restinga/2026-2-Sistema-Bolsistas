/**
 * Par rótulo/valor para painéis de detalhe. Use dentro de um <dl>.
 *
 * Uso:
 *   <dl className="grid grid-cols-2 gap-4">
 *     <KeyValue label="Vigência">01/09/2026 a 01/07/2027</KeyValue>
 *   </dl>
 */
export function KeyValue({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-gray-900">{children}</dd>
    </div>
  )
}
