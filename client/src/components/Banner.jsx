/**
 * Banner decorativo com gradiente verde (para boas-vindas, CTAs, etc.)
 */
export function Banner({ title, description, action }) {
  return (
    <div className="relative mb-6 flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-2xl bg-[linear-gradient(130deg,#1a5a26_0%,#1f6b2c_40%,var(--color-if-green-dark)_70%,var(--color-if-green)_100%)] p-6 shadow-[0_8px_24px_-4px_rgba(47,158,65,0.35)]">
      <div className="pointer-events-none absolute -top-8 -right-8 size-40 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute right-16 bottom-0 size-24 rounded-full bg-white/5" />
      <div className="relative">
        <h2 className="mb-1 text-lg leading-[1.3] font-bold text-white">{title}</h2>
        <p className="text-base text-green-100/90">{description}</p>
      </div>
      {action && <div className="relative shrink-0">{action}</div>}
    </div>
  )
}
