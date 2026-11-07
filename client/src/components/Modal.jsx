import { IconX } from './Icons'

/**
 * Modal genérico com overlay, título e descrição opcional.
 */
export function Modal({ title, description, onClose, children, width = 440 }) {
  return (
    <div
      className="fixed inset-0 z-50 flex animate-aparecer items-center justify-center bg-gray-950/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[calc(100vh-64px)] w-full overflow-y-auto rounded-card border border-gray-200 bg-white shadow-modal"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-1">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
            {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mt-1 -mr-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <IconX size={16} />
          </button>
        </div>
        <div className="px-5 pt-3 pb-5">{children}</div>
      </div>
    </div>
  )
}
