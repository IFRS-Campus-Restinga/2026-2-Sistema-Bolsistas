import { useState } from 'react'
import { projetosFetch } from '../api'
import {
  Alert,
  Button,
  Card,
  DocumentViewer,
  EmptyState,
  FileField,
  FormActions,
  FormField,
  IconEye,
  IconFileText,
  IconPaperclip,
  Modal,
  RichTextEditor,
  RichTextView,
  SectionTitle,
  useConfirm,
  useToast,
} from '../components'
import {
  enviarEmentaProjeto,
  removerEmentaProjeto,
  validarArquivoEmenta,
} from '../utils/ementaProjeto'
import { mensagemDeErro } from '../utils/mensagemDeErro'

/** Arquivo da ementa (PDF, DOC ou DOCX): enviar, substituir e remover. */
function ArquivoDaEmenta({ projeto, onAtualizado }) {
  const confirmar = useConfirm()
  const toast = useToast()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [versaoCampo, setVersaoCampo] = useState(0)

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
      toast({ message: 'Arquivo da ementa anexado.', tone: 'success' })
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
      setVersaoCampo((v) => v + 1)
    }
  }

  function remover() {
    confirmar({
      title: 'Remover arquivo da ementa',
      message: 'Remover o arquivo da ementa deste projeto?',
      confirmLabel: 'Remover',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await removerEmentaProjeto(projeto.id)
          onAtualizado({ ...projeto, arquivo_ementa: null, nome_original_arquivo: '' })
          toast({ message: 'Arquivo da ementa removido.', tone: 'success' })
        } catch (e) {
          setErro(e.message)
        }
      },
    })
  }

  return (
    <FormField
      label="Arquivo da ementa (opcional)"
      hint={`${projeto.arquivo_ementa ? 'Enviar outro arquivo substitui o atual. ' : ''}.pdf, .doc ou .docx, até 10 MB.`}
    >
      {erro && <Alert tone="error">{erro}</Alert>}
      {projeto.arquivo_ementa && (
        <div className="flex items-center justify-between gap-3 rounded-controle border border-gray-200 bg-gray-50 py-1.5 pr-1.5 pl-3">
          <span className="flex min-w-0 items-center gap-2 text-sm text-gray-700">
            <IconPaperclip size={15} className="shrink-0 text-gray-400" />
            <span className="truncate">{projeto.nome_original_arquivo || 'Arquivo anexado'}</span>
          </span>
          <Button size="sm" variant="ghost" onClick={remover} disabled={enviando}>
            Remover
          </Button>
        </div>
      )}
      <FileField
        key={versaoCampo}
        value={enviando ? 'Enviando...' : ''}
        onChange={selecionarArquivo}
        accept=".pdf,.doc,.docx"
        disabled={enviando}
      />
    </FormField>
  )
}

/**
 * Ementa do projeto como no protótipo (US90): o texto escrito no editor, com "Ver PDF"
 * para o arquivo anexado e "Editar" para o texto e o arquivo.
 */
export default function EmentaProjetoCard({ projeto, onAtualizado, className = '' }) {
  const toast = useToast()
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [verArquivo, setVerArquivo] = useState(false)

  const podeAlterar = projeto.status === 'ATIVO'
  const temTexto = Boolean(projeto.ementa_html)

  function abrirEdicao() {
    setRascunho(projeto.ementa_html || '')
    setErro('')
    setEditando(true)
  }

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      const res = await projetosFetch(`/${projeto.id}/ementa/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ementa_html: rascunho }),
      })
      const dados = await res.json().catch(() => null)
      if (!res.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível salvar a ementa.'))
      onAtualizado(dados)
      setEditando(false)
      toast({ message: 'Ementa salva.', tone: 'success' })
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className={className}>
      <SectionTitle
        title="Ementa"
        action={
          <div className="flex gap-1.5">
            {projeto.arquivo_ementa && (
              <Button size="sm" variant="ghost" onClick={() => setVerArquivo(true)}>
                <IconEye /> Ver PDF
              </Button>
            )}
            {podeAlterar && (
              <Button size="sm" onClick={abrirEdicao}>
                Editar
              </Button>
            )}
          </div>
        }
      />
      {temTexto ? (
        <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
          <RichTextView html={projeto.ementa_html} maxHeight={260} />
        </div>
      ) : (
        <EmptyState
          compact
          icon={<IconFileText />}
          title="Nenhuma ementa escrita"
          description="Descreva objetivos, metodologia e resultados esperados do projeto."
          action={
            podeAlterar && (
              <Button size="sm" variant="primary" onClick={abrirEdicao}>
                Escrever ementa
              </Button>
            )
          }
        />
      )}

      {editando && (
        <Modal title="Editar ementa" width={720} onClose={() => !salvando && setEditando(false)}>
          {erro && <Alert tone="error">{erro}</Alert>}
          <div className="mb-4">
            <RichTextEditor
              value={rascunho}
              onChange={setRascunho}
              minHeight={280}
              placeholder="Descreva objetivos, metodologia e resultados esperados…"
            />
          </div>
          <ArquivoDaEmenta projeto={projeto} onAtualizado={onAtualizado} />
          <FormActions>
            <Button onClick={() => setEditando(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={salvar} loading={salvando}>
              Salvar ementa
            </Button>
          </FormActions>
        </Modal>
      )}

      {verArquivo && (
        <DocumentViewer
          docs={[
            {
              id: 'ementa',
              label: 'Ementa do projeto',
              fileName: projeto.nome_original_arquivo || 'ementa',
              url: projeto.arquivo_ementa,
            },
          ]}
          onClose={() => setVerArquivo(false)}
        />
      )}
    </Card>
  )
}
