import { useRef } from 'react'
import { IconUpload, IconPaperclip, IconX } from './Icons'

// Campos e botões herdam line-height "normal" do navegador; leading-[normal] mantém a
// mesma altura.
const INPUT =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 [font-family:inherit] text-base leading-[normal] text-gray-800 outline-none transition-shadow duration-150 ease-[ease] focus:border-green-300 focus:shadow-[0_0_0_3px_rgba(74,222,128,0.25)] disabled:bg-gray-50 disabled:text-gray-400'

/**
 * Wrapper de campo de formulário com label.
 *
 * `className` substitui a margem padrão (mb-4), ex.: className="mb-0" em filtros.
 */
export function FormField({ label, children, className = 'mb-4' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-semibold text-gray-500">{label}</label>
      {children}
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
  return <textarea {...props} className={`${INPUT} ${props.className ?? ''}`} />
}

/**
 * Select / dropdown.
 */
export function Select(props) {
  return <select {...props} className={`${INPUT} ${props.className ?? ''}`} />
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
        <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 py-2 pr-2 pl-3">
          <span className="flex min-w-0 items-center gap-2 text-base text-gray-700">
            <IconPaperclip size={16} className="shrink-0 text-gray-400" />
            <span className="truncate">{value}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="shrink-0 cursor-pointer border-0 bg-transparent p-0.5 leading-[normal] text-gray-400 hover:text-gray-600"
            disabled={disabled}
          >
            <IconX size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-transparent p-3 text-base leading-[normal] text-gray-500 transition-all duration-150 ease-[ease] hover:border-if-green hover:bg-green-50/50 hover:text-if-green"
          disabled={disabled}
        >
          <IconUpload size={16} />
          Selecionar arquivo
        </button>
      )}
    </div>
  )
}
