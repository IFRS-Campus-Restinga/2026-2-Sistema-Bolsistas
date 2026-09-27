import { useState } from 'react'
import { Alert, Button, FileField, IconPaperclip, useConfirm, useToast } from '../components'
import {
  enviarEmentaProjeto,
  removerEmentaProjeto,
  validarArquivoEmenta,
} from '../utils/ementaProjeto'

/**
 * Matriz / ementa do projeto na tela de detalhe: mostra o arquivo atual e,
 * com o projeto Ativo, permite anexar, trocar ou remover.
 */
export default function EmentaProjetoCard({ projeto, onAtualizado }) {
  const confirmar = useConfirm()
  const toast = useToast()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  // Remonta o FileField depois de cada envio, pra dar pra escolher o mesmo arquivo de novo.
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
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
      }}
    >
      <strong>Matriz / ementa</strong>
      {erro && <Alert tone="error">{erro}</Alert>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        {projeto.arquivo_ementa ? (
          <a
            href={projeto.arquivo_ementa}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <IconPaperclip size={14} />
            {projeto.nome_original_arquivo || 'Abrir arquivo'}
          </a>
        ) : (
          <span style={{ color: '#9ca3af' }}>Nenhum arquivo anexado.</span>
        )}
        {podeAlterar && projeto.arquivo_ementa && (
          <Button size="sm" variant="danger" onClick={remover} disabled={enviando}>
            Remover
          </Button>
        )}
      </div>

      {podeAlterar && (
        <div style={{ marginTop: 12 }}>
          <FileField
            key={versaoCampo}
            value={enviando ? 'Enviando...' : ''}
            onChange={selecionarArquivo}
            accept=".pdf,.doc,.docx"
            disabled={enviando}
          />
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
            {projeto.arquivo_ementa ? 'Enviar outro arquivo substitui o atual. ' : ''}
            .pdf, .doc ou .docx, até 10 MB.
          </p>
        </div>
      )}
    </div>
  )
}
