import { useRef } from 'react'
import { IconUpload, IconPaperclip, IconX } from './Icons'

// Padrão do protótipo: altura fixa, borda neutra e anel cinza no foco.
const INPUT =
  'h-9 w-full rounded-controle border border-gray-200 bg-white px-3 [font-family:inherit] text-sm leading-[normal] text-gray-900 outline-none transition-shadow duration-150 ease-[ease] placeholder:text-gray-400 focus:border-gray-400 focus:ring-4 focus:ring-gray-100 disabled:bg-gray-50 disabled:text-gray-400'

/**
 * Wrapper de campo de formulário com label e dica opcional abaixo do campo.
 *
 * `className` substitui a margem padrão (mb-4), ex.: className="mb-0" em filtros.
 */
export function FormField({ label, children, hint, className = 'mb-4' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </div>
  )
}

/**
 * Ações de rodapé de formulário (Cancelar / Salvar).
 */
export function FormActions({ children }) {
  return <div className="mt-2 flex justify-end gap-2.5">{children}</div>
}

/**
 * Input de texto.
 */
export function TextInput(props) {
  return <input {...props} className={`${INPUT} ${props.className ?? ''}`} />
}

/**
 * Textarea.
 */
export function TextArea(props) {
  return <textarea {...props} className={`${INPUT} h-auto py-2 ${props.className ?? ''}`} />
}

/**
 * Select / dropdown.
 */
export function Select(props) {
  return <select {...props} className={`${INPUT} pr-8 ${props.className ?? ''}`} />
}

/**
 * Campo de upload de arquivo estilizado.
 *
 * Props:
 *   value    — nome do arquivo selecionado ("" se nenhum)
 *   onChange — callback(fileName)
 *   accept   — tipos aceitos (ex: ".pdf,.doc")
 *   required
 */
export function FileField({ value, onChange, accept, required, disabled }) {
  const inputRef = useRef(null)

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        required={required && !value}
        disabled={disabled}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />

      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-controle border border-gray-200 bg-gray-50 py-1.5 pr-1.5 pl-3">
          <span className="flex min-w-0 items-center gap-2 text-sm text-gray-700">
            <IconPaperclip size={15} className="shrink-0 text-gray-400" />
            <span className="truncate">{value}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
            aria-label="Remover arquivo"
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent leading-[normal] text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            disabled={disabled}
          >
            <IconX size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-controle border border-dashed border-gray-300 bg-transparent p-3 text-sm leading-[normal] text-gray-500 transition-colors duration-150 ease-[ease] hover:border-gray-400 hover:bg-gray-50 hover:text-gray-800"
          disabled={disabled}
        >
          <IconUpload size={16} />
          Selecionar arquivo
        </button>
      )}
    </div>
  )
}
