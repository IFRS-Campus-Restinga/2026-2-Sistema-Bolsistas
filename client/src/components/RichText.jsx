import { useEffect, useRef } from 'react'
import { IconBold, IconH1, IconH2, IconItalic, IconList, IconListOrdered, IconQuote } from './Icons'

const FERRAMENTAS = [
  { titulo: 'Título', icone: <IconH1 />, comando: ['formatBlock', '<h1>'] },
  { titulo: 'Subtítulo', icone: <IconH2 />, comando: ['formatBlock', '<h2>'] },
  { titulo: 'Negrito', icone: <IconBold />, comando: ['bold'] },
  { titulo: 'Itálico', icone: <IconItalic />, comando: ['italic'] },
  { titulo: 'Lista', icone: <IconList />, comando: ['insertUnorderedList'] },
  { titulo: 'Lista numerada', icone: <IconListOrdered />, comando: ['insertOrderedList'] },
  { titulo: 'Citação', icone: <IconQuote />, comando: ['formatBlock', '<blockquote>'] },
]
// Separador antes do negrito, das listas e da citação, como no protótipo.
const SEPARADOR_ANTES = new Set([2, 4, 6])

/**
 * Editor de texto com título, subtítulo, negrito, itálico, listas e citação (US90).
 * Guarda HTML; o backend limpa e mantém só essas tags.
 */
export function RichTextEditor({ value, onChange, placeholder, minHeight = 140 }) {
  const editor = useRef(null)

  useEffect(() => {
    if (editor.current && editor.current.innerHTML !== value) editor.current.innerHTML = value
  }, [value])

  function aplicar([comando, argumento]) {
    editor.current?.focus()
    document.execCommand(comando, false, argumento)
    onChange(editor.current?.innerHTML ?? '')
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white focus-within:border-gray-400 focus-within:ring-4 focus-within:ring-gray-100">
      <div className="flex items-center gap-0.5 border-b border-gray-100 bg-gray-50/60 px-1.5 py-1">
        {FERRAMENTAS.map((ferramenta, indice) => (
          <span key={ferramenta.titulo} className="flex items-center">
            {SEPARADOR_ANTES.has(indice) && <span className="mx-1 h-4 w-px bg-gray-200" />}
            <button
              type="button"
              title={ferramenta.titulo}
              aria-label={ferramenta.titulo}
              onMouseDown={(evento) => {
                evento.preventDefault()
                aplicar(ferramenta.comando)
              }}
              className="flex size-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-gray-500 hover:bg-gray-200/60 hover:text-gray-900"
            >
              {ferramenta.icone}
            </button>
          </span>
        ))}
      </div>
      <div
        ref={editor}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={(evento) => onChange(evento.currentTarget.innerHTML)}
        className="rich-text px-3 py-2.5 text-sm leading-relaxed text-gray-800 outline-none"
        style={{ minHeight }}
      />
    </div>
  )
}

/** Texto formatado (já limpo pelo backend), com rolagem a partir de `maxHeight`. */
export function RichTextView({ html, maxHeight = 220 }) {
  return (
    <div
      className="rich-text overflow-y-auto pr-2 text-sm leading-relaxed text-gray-700"
      style={{ maxHeight }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
