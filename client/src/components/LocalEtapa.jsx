/**
 * Mostra o local de uma etapa: vira link se for uma URL (reunião online),
 * senão aparece como texto (ex.: "Sala 204").
 */
export function LocalEtapa({ local }) {
  if (!local) return <span style={{ color: '#9ca3af' }}>—</span>
  if (/^https?:\/\//i.test(local)) {
    return (
      <a href={local} target="_blank" rel="noopener noreferrer">
        Link da reunião
      </a>
    )
  }
  return local
}
