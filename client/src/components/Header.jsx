export default function Header({ usuario }) {
  const iniciais = usuario?.nome
    ? usuario.nome
        .split(' ')
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
    : '?'

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">Campus Restinga</p>
        <h1 className="text-base font-semibold text-gray-800">Sistema de Bolsistas</h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-700">{usuario?.nome || ''}</span>
        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">
          {iniciais}
        </div>
      </div>
    </header>
  )
}
