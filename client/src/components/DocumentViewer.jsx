import { useEffect, useRef, useState } from 'react'
import { arquivoFetch } from '../api'
import { Alert } from './Alert'
import { StatusPill } from './Badge'
import { Button } from './Button'
import { FormField, TextArea } from './FormField'
import {
  IconCheckCircle,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFileText,
  IconX,
  IconXCircle,
  IconZoomIn,
  IconZoomOut,
} from './Icons'
import { Spinner } from './Spinner'

// Largura da página em 100%, como no protótipo.
const LARGURA_PAGINA = 600
const ZOOM_MINIMO = 60
const ZOOM_MAXIMO = 160
const PASSO_ZOOM = 20

const CHECKLIST_PADRAO = [
  'Documento legível',
  'Dados conferem com o cadastro',
  'Assinatura/autenticação presente',
]

const EXTENSOES_IMAGEM = /\.(png|jpe?g)$/i

function tipoDoArquivo(blob, nome) {
  if (blob.type === 'application/pdf' || /\.pdf$/i.test(nome)) return 'pdf'
  if (blob.type.startsWith('image/') || EXTENSOES_IMAGEM.test(nome)) return 'imagem'
  return 'outro'
}

async function abrirPdf(blob) {
  const [pdfjs, { default: worker }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  return pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
}

/**
 * Baixa o arquivo do documento uma vez e guarda enquanto o visualizador estiver aberto,
 * para trocar de documento sem baixar de novo.
 */
function useArquivo({ id, url, fileName } = {}) {
  const cache = useRef(new Map())
  const [estado, setEstado] = useState({ id: null })

  useEffect(() => {
    const arquivos = cache.current
    return () => {
      arquivos.forEach((arquivo) => {
        URL.revokeObjectURL(arquivo.url)
        arquivo.pdf?.loadingTask.destroy()
      })
    }
  }, [])

  useEffect(() => {
    if (!id) return undefined
    let ativo = true
    const guardado = cache.current.get(id)
    async function carregar() {
      try {
        const res = await arquivoFetch(url)
        if (!res.ok) throw new Error('Não foi possível abrir o documento.')
        const blob = await res.blob()
        const tipo = tipoDoArquivo(blob, fileName)
        const arquivo = { tipo, url: URL.createObjectURL(blob), paginas: 1 }
        if (tipo === 'pdf') {
          arquivo.pdf = await abrirPdf(blob)
          arquivo.paginas = arquivo.pdf.numPages
        }
        cache.current.set(id, arquivo)
        if (ativo) setEstado({ id, ...arquivo })
      } catch (error) {
        if (ativo) setEstado({ id, erro: error.message })
      }
    }
    if (guardado) setEstado({ id, ...guardado })
    else {
      setEstado({ id, carregando: true })
      carregar()
    }
    return () => {
      ativo = false
    }
  }, [id, url, fileName])

  return estado.id === id ? estado : { carregando: true }
}

function PaginaPdf({ pdf, pagina, zoom }) {
  const canvas = useRef(null)

  useEffect(() => {
    let tarefa = null
    let ativo = true
    async function desenhar() {
      const pag = await pdf.getPage(pagina)
      if (!ativo || !canvas.current) return
      const densidade = window.devicePixelRatio || 1
      const escala = (LARGURA_PAGINA * zoom) / 100 / pag.getViewport({ scale: 1 }).width
      const viewport = pag.getViewport({ scale: escala * densidade })
      const elemento = canvas.current
      elemento.width = viewport.width
      elemento.height = viewport.height
      elemento.style.width = `${viewport.width / densidade}px`
      elemento.style.height = `${viewport.height / densidade}px`
      tarefa = pag.render({ canvas: elemento, viewport })
      await tarefa.promise.catch(() => {})
    }
    desenhar()
    return () => {
      ativo = false
      tarefa?.cancel()
    }
  }, [pdf, pagina, zoom])

  return <canvas ref={canvas} className="mx-auto block bg-white shadow-2xl" />
}

/** Checklist e decisão (aprovar ou recusar com motivo) do documento aberto. */
function PainelRevisao({ doc, marcados, onMarcar, onDecidir }) {
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const checklist = doc.checklist ?? CHECKLIST_PADRAO
  const tudoMarcado = checklist.every((_, i) => marcados[i])

  async function decidir(decisao) {
    setSalvando(true)
    setErro('')
    try {
      await onDecidir(decisao, decisao === 'REJEITADO' ? motivo : '')
    } catch (error) {
      setErro(error.message)
      setSalvando(false)
    }
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="text-[15px] font-semibold text-gray-900">Revisão</div>
        <div className="mt-0.5 text-sm text-gray-500">{doc.owner ?? 'Documento enviado'}</div>
        <div className="mt-2">
          <StatusPill status={doc.decision ?? 'PENDENTE'} label={doc.decisionLabel} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {erro && <Alert tone="error">{erro}</Alert>}
        {doc.decision === 'REJEITADO' && doc.motivoRecusa && !recusando && (
          <Alert tone="error" title="Motivo da recusa">
            {doc.motivoRecusa}
          </Alert>
        )}
        <p className="mb-2 text-xs font-medium text-gray-500">Checklist</p>
        <ul className="m-0 list-none space-y-1 p-0">
          {checklist.map((item, i) => (
            <li key={item}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={Boolean(marcados[i])}
                  onChange={(evento) => onMarcar(i, evento.target.checked)}
                  className="mt-0.5 size-4 accent-brand"
                />
                {item}
              </label>
            </li>
          ))}
        </ul>
        {recusando && (
          <div className="mt-4">
            <FormField
              label="Motivo da recusa"
              hint="O aluno verá este texto e poderá reenviar o documento."
            >
              <TextArea
                rows={4}
                value={motivo}
                maxLength={5000}
                onChange={(evento) => setMotivo(evento.target.value)}
                placeholder="Ex.: o histórico enviado está incompleto (falta a página 2)."
              />
            </FormField>
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-gray-200 px-5 py-3">
        {recusando ? (
          <>
            <Button
              className="flex-1 justify-center"
              disabled={salvando}
              onClick={() => setRecusando(false)}
            >
              Voltar
            </Button>
            <Button
              variant="danger"
              className="flex-1 justify-center"
              disabled={!motivo.trim()}
              loading={salvando}
              onClick={() => decidir('REJEITADO')}
            >
              Confirmar recusa
            </Button>
          </>
        ) : (
          <>
            <Button
              className="flex-1 justify-center"
              disabled={salvando}
              onClick={() => setRecusando(true)}
            >
              Recusar
            </Button>
            <Button
              variant="accent"
              className="flex-1 justify-center"
              disabled={!tudoMarcado}
              loading={salvando}
              title={tudoMarcado ? '' : 'Marque todos os itens do checklist'}
              onClick={() => decidir('APROVADO')}
            >
              Aprovar
            </Button>
          </>
        )}
      </div>
    </aside>
  )
}

function BotaoBarra({ children, label, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-gray-300 hover:bg-gray-800 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
      {...props}
    >
      {children}
    </button>
  )
}

/**
 * Pré-visualização de documentos embutida, sem baixar: lista dos documentos ao lado,
 * páginas e zoom. PDF é desenhado com o pdf.js; imagens aparecem direto. Com `onDecide`,
 * mostra a revisão (checklist e decisão) e, após decidir, avança ao próximo pendente;
 * quando não resta nenhum, fecha.
 *
 * Props:
 *   docs      — formato de utils/documentos.js; `url` é o endereço do arquivo na API
 *   initialId — documento aberto primeiro (padrão: o primeiro da lista)
 *   onClose   — fecha o visualizador (também com Esc ou clique fora)
 *   onDecide  — async (id, decisao, motivo); um erro lançado aparece no painel
 */
export function DocumentViewer({ docs, initialId, onClose, onDecide }) {
  const [atualId, setAtualId] = useState(initialId ?? docs[0]?.id)
  const [zoom, setZoom] = useState(100)
  const [pagina, setPagina] = useState(1)
  const [marcados, setMarcados] = useState({}) // { [docId]: { [indice]: true } }
  const doc = docs.find((d) => d.id === atualId) ?? docs[0]
  const arquivo = useArquivo(doc)
  const paginas = arquivo.paginas ?? 1

  // Na captura da window, antes do Drawer ou Modal de baixo: o Esc fecha só o visualizador.
  useEffect(() => {
    function aoTeclar(evento) {
      if (evento.key !== 'Escape') return
      evento.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', aoTeclar, true)
    return () => window.removeEventListener('keydown', aoTeclar, true)
  }, [onClose])

  if (!doc) return null

  function selecionar(id) {
    setAtualId(id)
    setPagina(1)
  }

  async function decidir(decisao, motivo) {
    await onDecide(doc.id, decisao, motivo)
    const indice = docs.findIndex((d) => d.id === doc.id)
    const proximo = [...docs.slice(indice + 1), ...docs.slice(0, indice)].find(
      (d) => !d.decision || d.decision === 'PENDENTE'
    )
    // Sem pendentes, a revisão acabou: volta para a tela de onde o visualizador abriu.
    if (proximo) selecionar(proximo.id)
    else onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-aparecer bg-gray-950/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Visualizar ${doc.label}`}
        className="flex h-full w-full"
        onClick={(evento) => evento.stopPropagation()}
      >
        <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-800 bg-gray-900 md:flex">
          <div className="px-4 py-4 text-xs font-medium text-gray-400">
            Documentos · {docs.length}
          </div>
          <ul className="m-0 flex-1 list-none overflow-y-auto px-2">
            {docs.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => selecionar(d.id)}
                  aria-current={d.id === doc.id}
                  className={`mb-0.5 flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 px-2.5 py-2 text-left ${
                    d.id === doc.id
                      ? 'bg-gray-800 text-white'
                      : 'bg-transparent text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                  }`}
                >
                  <IconFileText size={16} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{d.label}</span>
                    <span className="block truncate text-2xs text-gray-500">{d.fileName}</span>
                  </span>
                  {d.decision === 'APROVADO' && (
                    <IconCheckCircle size={14} className="text-emerald-400" />
                  )}
                  {d.decision === 'REJEITADO' && <IconXCircle size={14} className="text-red-400" />}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-gray-800">
          <div className="flex h-12 items-center justify-between gap-3 border-b border-gray-700 bg-gray-900 px-4 text-gray-300">
            <div className="min-w-0 truncate text-sm">
              <span className="font-medium text-white">{doc.label}</span>
              <span className="text-gray-500"> · {doc.fileName}</span>
            </div>
            <div className="flex items-center gap-1">
              <BotaoBarra
                label="Página anterior"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                <IconChevronLeft />
              </BotaoBarra>
              <span className="w-16 text-center text-xs tabular-nums">
                {pagina} / {paginas}
              </span>
              <BotaoBarra
                label="Próxima página"
                disabled={pagina >= paginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                <IconChevronRight />
              </BotaoBarra>
              <span className="mx-2 h-4 w-px bg-gray-700" />
              <BotaoBarra
                label="Diminuir zoom"
                disabled={zoom <= ZOOM_MINIMO}
                onClick={() => setZoom((z) => Math.max(ZOOM_MINIMO, z - PASSO_ZOOM))}
              >
                <IconZoomOut />
              </BotaoBarra>
              <span className="w-11 text-center text-xs tabular-nums">{zoom}%</span>
              <BotaoBarra
                label="Aumentar zoom"
                disabled={zoom >= ZOOM_MAXIMO}
                onClick={() => setZoom((z) => Math.min(ZOOM_MAXIMO, z + PASSO_ZOOM))}
              >
                <IconZoomIn />
              </BotaoBarra>
              <span className="mx-2 h-4 w-px bg-gray-700" />
              <a
                href={arquivo.url}
                download={doc.fileName}
                aria-disabled={!arquivo.url}
                className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-gray-300 no-underline hover:bg-gray-800 ${
                  arquivo.url ? '' : 'pointer-events-none opacity-40'
                }`}
              >
                <IconDownload size={14} /> Baixar
              </a>
              <BotaoBarra label="Fechar" onClick={onClose}>
                <IconX size={16} />
              </BotaoBarra>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-8">
            {arquivo.carregando && (
              <div className="flex h-full items-center justify-center text-gray-400">
                <Spinner />
              </div>
            )}
            {arquivo.erro && (
              <p className="mt-20 text-center text-sm text-gray-300">{arquivo.erro}</p>
            )}
            {arquivo.tipo === 'pdf' && <PaginaPdf pdf={arquivo.pdf} pagina={pagina} zoom={zoom} />}
            {arquivo.tipo === 'imagem' && (
              <img
                src={arquivo.url}
                alt={doc.label}
                className="mx-auto block bg-white shadow-2xl"
                style={{ width: (LARGURA_PAGINA * zoom) / 100 }}
              />
            )}
            {arquivo.tipo === 'outro' && (
              <p className="mt-20 text-center text-sm text-gray-300">
                Este tipo de arquivo não pode ser exibido aqui. Use o botão Baixar.
              </p>
            )}
          </div>
        </section>

        {onDecide && (
          <PainelRevisao
            key={`${doc.id}-${doc.decision}`}
            doc={doc}
            marcados={marcados[doc.id] ?? {}}
            onMarcar={(i, marcado) =>
              setMarcados((atual) => ({ ...atual, [doc.id]: { ...atual[doc.id], [i]: marcado } }))
            }
            onDecidir={decidir}
          />
        )}
      </div>
    </div>
  )
}
