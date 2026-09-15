import { useRef } from 'react'
import { IconUpload, IconPaperclip, IconX } from './Icons'
import './FormField.css'

/**
 * Wrapper de campo de formulário com label.
 */
export function FormField({ label, children }) {
  return (
    <div className="form-field">
      <label className="form-field__label">{label}</label>
      {children}
    </div>
  )
}

/**
 * Ações de rodapé de formulário (Cancelar / Salvar).
 */
export function FormActions({ children }) {
  return <div className="form-actions">{children}</div>
}

/**
 * Input de texto.
 */
export function TextInput(props) {
  return <input {...props} className={`form-input ${props.className ?? ''}`} />
}

/**
 * Textarea.
 */
export function TextArea(props) {
  return <textarea {...props} className={`form-input ${props.className ?? ''}`} />
}

/**
 * Select / dropdown.
 */
export function Select(props) {
  return <select {...props} className={`form-input ${props.className ?? ''}`} />
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
export function FileField({ value, onChange, accept, required }) {
  const inputRef = useRef(null)

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        required={required && !value}
        className="form-file__hidden"
        onChange={(e) => onChange(e.target.files?.[0]?.name ?? '')}
      />

      {value ? (
        <div className="form-file__selected">
          <span className="form-file__name">
            <IconPaperclip size={16} className="form-file__icon" />
            <span className="form-file__name-text">{value}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange('')
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="form-file__remove"
          >
            <IconX size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="form-file__trigger"
        >
          <IconUpload size={16} />
          Selecionar arquivo
        </button>
      )}
    </div>
  )
}
