import { useCallback, useState } from 'react'
import { ToastContext } from './useToast'
import { IconCheck, IconX, IconAlertTriangle, IconInfoCircle } from './Icons'

let nextId = 0

const CLASSES_POR_TONE = {
  success: 'border-green-200 bg-green-50 text-green-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-gray-200 bg-gray-50 text-gray-700',
}

const ICONS = {
  success: IconCheck,
  error: IconX,
  warning: IconAlertTriangle,
  info: IconInfoCircle,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback(({ message, tone = 'info', duration = 4000 }) => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const remover = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {toasts.length > 0 && (
        <div
          className="pointer-events-none fixed right-6 bottom-6 z-[200] flex flex-col gap-2.5"
          role="status"
          aria-live="polite"
        >
          {toasts.map((t) => {
            const IconComponent = ICONS[t.tone] ?? ICONS.info
            return (
              <div
                key={t.id}
                className={`pointer-events-auto flex max-w-[400px] min-w-[260px] animate-surgir items-center gap-2.5 rounded-xl border px-4 py-3 text-base shadow-modal ${CLASSES_POR_TONE[t.tone] ?? ''}`}
              >
                <span className="flex shrink-0 items-center justify-center">
                  <IconComponent size={16} />
                </span>
                <span className="flex-1 leading-[1.4]">{t.message}</span>
                <button
                  className="shrink-0 cursor-pointer border-0 bg-transparent px-0.5 text-[18px] leading-none text-inherit opacity-60 hover:opacity-100"
                  onClick={() => remover(t.id)}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </ToastContext.Provider>
  )
}
