import { useEffect } from 'react'
import { IconX } from './Icons'

/**
 * Painel lateral para detalhes e decisões sem sair da página (ex.: revisar um candidato).
 * Fecha ao clicar fora, no X ou com Esc.
 *
 * Props:
 *   subtitle — linha abaixo do título
 *   footer   — ações fixas no rodapé (ex.: Reprovar / Aprovar)
 *   width    — largura máxima em px
 *
 * Uso:
 *   <Drawer title="Beatriz Nunes" subtitle="ADS · 4º período" onClose={fechar} footer={acoes}>
 *     ...
 *   </Drawer>
 */
export function Drawer({ title, subtitle, onClose, children, footer, width = 520 }) {
  useEffect(() => {
    function aoTeclar(evento) {
      if (evento.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex animate-aparecer justify-end bg-gray-950/30"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full animate-entrar-direita flex-col border-l border-gray-200 bg-white shadow-modal"
        style={{ maxWidth: width }}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-gray-900">{title}</h3>
            {subtitle && <div className="mt-0.5 text-sm text-gray-500">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <IconX size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">{footer}</div>
        )}
      </aside>
    </div>
  )
}
