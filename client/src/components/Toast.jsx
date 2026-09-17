import './Toast.css'
import { useCallback, useState } from 'react'
import { ToastContext } from './useToast'
import { IconCheck, IconX, IconAlertTriangle, IconInfoCircle } from './Icons'

let nextId = 0

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
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => {
            const IconComponent = ICONS[t.tone] ?? ICONS.info
            return (
              <div key={t.id} className={`toast toast--${t.tone}`}>
                <span className="toast__icon">
                  <IconComponent size={16} />
                </span>
                <span className="toast__message">{t.message}</span>
                <button className="toast__close" onClick={() => remover(t.id)} aria-label="Fechar">
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
