const menuItems = [
  { label: 'Dashboard', icon: '⊞' },
  { label: 'Editais', icon: '📄' },
  { label: 'Projetos', icon: '📁' },
  { label: 'Usuários', icon: '👥' },
]

export default function Sidebar({ activeItem = 'Usuários' }) {
  return (
    <aside className="flex flex-col w-56 min-h-screen bg-white border-r border-gray-200">
      <div className="px-6 py-5 border-b border-gray-200">
        <span className="text-lg font-bold text-green-700">SIGAA-ME</span>
      </div>

      <nav className="flex-1 py-4">
        {menuItems.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-3 px-6 py-3 text-sm cursor-pointer transition-colors ${
              activeItem === item.label
                ? 'bg-green-50 text-green-700 font-semibold border-r-2 border-green-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-gray-200">
        <span className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">Sair</span>
      </div>
    </aside>
  )
}
