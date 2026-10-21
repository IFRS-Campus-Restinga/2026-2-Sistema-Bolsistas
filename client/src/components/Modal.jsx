/**
 * Modal genérico com overlay e cabeçalho.
 */
export function Modal({ title, onClose, children, width = 440 }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.5)] p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100vh-64px)] w-full overflow-y-auto rounded-2xl bg-white shadow-modal"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f4f4f4] px-6 py-4">
          <h3 className="text-[16px] font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="flex size-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-400 transition-all duration-150 ease-[ease] hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
