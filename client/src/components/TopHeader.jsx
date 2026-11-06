/**
 * Cabeçalho superior com campus + dados do usuário logado.
 *
 * Props:
 *   campus   — nome do campus ("Campus Restinga")
 *   name     — nome do usuário
 *   role     — papel/perfil
 *   initials — iniciais para o avatar
 */
export function TopHeader({ campus, name, role, initials }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#f0f0f0] bg-white px-8 shadow-[0_1px_0_#f4f4f4]">
      <div className="flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-if-green" />
        <span className="text-base font-medium tracking-wide text-gray-400">{campus}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-base leading-[1.2] font-semibold text-gray-800">{name}</div>
          <div className="text-2xs font-semibold text-if-green">{role}</div>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-if-green-dark),var(--color-if-green))] text-xs font-bold text-white shadow-[0_2px_6px_rgba(47,158,65,0.3)]">
          {initials}
        </div>
      </div>
    </header>
  )
}
