import { useState } from 'react'
import { Alert, Button, FileField, IconPaperclip, useConfirm, useToast } from '../components'
import {
  enviarEmentaProjeto,
  removerEmentaProjeto,
  validarArquivoEmenta,
} from '../utils/ementaProjeto'

export default function EmentaProjetoCard({ projeto, onAtualizado }) {
  const confirmar = useConfirm()
  const toast = useToast()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [versaoCampo, setVersaoCampo] = useState(0)

  const podeAlterar = projeto.status === 'ATIVO'

  async function selecionarArquivo(arquivo) {
    if (!arquivo) return
    const erroArquivo = validarArquivoEmenta(arquivo)
    if (erroArquivo) {
      setErro(erroArquivo)
      setVersaoCampo((v) => v + 1)
      return
    }
    setEnviando(true)
    setErro('')
    try {
      onAtualizado(await enviarEmentaProjeto(projeto.id, arquivo))
      toast({ message: 'Matriz/ementa anexada.', tone: 'success' })
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
      setVersaoCampo((v) => v + 1)
    }
  }

  function remover() {
    confirmar({
      title: 'Remover matriz/ementa',
      message: 'Remover o arquivo de matriz/ementa deste projeto?',
      confirmLabel: 'Remover',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await removerEmentaProjeto(projeto.id)
          onAtualizado({ ...projeto, arquivo_ementa: null, nome_original_arquivo: '' })
          toast({ message: 'Matriz/ementa removida.', tone: 'success' })
        } catch (e) {
          setErro(e.message)
        }
      },
    })
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <strong>Matriz / ementa</strong>
      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="mt-2 flex items-center gap-3">
        {projeto.arquivo_ementa ? (
          <a
            href={projeto.arquivo_ementa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
          >
            <IconPaperclip size={14} />
            {projeto.nome_original_arquivo || 'Abrir arquivo'}
          </a>
        ) : (
          <span className="text-gray-400">Nenhum arquivo anexado.</span>
        )}
        {podeAlterar && projeto.arquivo_ementa && (
          <Button size="sm" variant="danger" onClick={remover} disabled={enviando}>
            Remover
          </Button>
        )}
      </div>

      {podeAlterar && (
        <div className="mt-3">
          <FileField
            key={versaoCampo}
            value={enviando ? 'Enviando...' : ''}
            onChange={selecionarArquivo}
            accept=".pdf,.doc,.docx"
            disabled={enviando}
          />
          <p className="mt-1 text-xs text-gray-400">
            {projeto.arquivo_ementa ? 'Enviar outro arquivo substitui o atual. ' : ''}
            .pdf, .doc ou .docx, até 10 MB.
          </p>
        </div>
      )}
    </div>
  )
}
