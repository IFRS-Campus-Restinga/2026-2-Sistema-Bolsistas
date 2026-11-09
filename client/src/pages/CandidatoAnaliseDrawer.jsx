import { useEffect, useRef, useState } from 'react'
import { inscricoesFetch } from '../api'
import {
  Alert,
  Button,
  Carregando,
  DocList,
  DocumentViewer,
  Drawer,
  FormField,
  IconEye,
  StatusPill,
  TextArea,
  useConfirm,
} from '../components'
import { documentosParaViewer } from '../utils/documentos'
import { mensagemDeErro } from '../utils/mensagemDeErro'

/** Texto inicial do motivo: cada documento recusado com o motivo da recusa. */
function motivoDosRecusados(recusados) {
  return recusados.map((documento) => `${documento.label}: ${documento.motivoRecusa}`).join('\n')
}

/**
 * Análise de uma inscrição na etapa Inscritos: documentos revisados um a um no
 * visualizador e a decisão de homologar (só com todos aprovados) ou indeferir.
 */
export default function CandidatoAnaliseDrawer({ candidatoId, onFechar, onAtualizado, onDecisao }) {
  const [candidato, setCandidato] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [indeferindo, setIndeferindo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [visualizando, setVisualizando] = useState(null)
  const ocupado = useRef(false)
  // Versão mais recente, lida ao fechar o visualizador logo após a última decisão.
  const ultimoCandidato = useRef(null)
  // Motivo montado a partir dos recusados, para saber se o coordenador o editou.
  const textoAutomatico = useRef('')
  const confirmar = useConfirm()

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const res = await inscricoesFetch(`/candidatos/${candidatoId}/`)
        const dados = await res.json().catch(() => null)
        if (!res.ok || !dados) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar a inscrição.'))
        }
        ultimoCandidato.current = dados
        if (ativo) setCandidato(dados)
      } catch (e) {
        if (ativo) setErro(e.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [candidatoId])

  function fechar() {
    if (ocupado.current) return
    if (motivo.trim()) {
      confirmar({
        title: 'Descartar motivo?',
        message: 'O motivo do indeferimento não salvo será perdido.',
        confirmLabel: 'Descartar',
        tone: 'danger',
        onConfirm: onFechar,
      })
    } else onFechar()
  }

  async function decidir(acao) {
    if (ocupado.current) return
    ocupado.current = true
    setSalvando(true)
    setErro('')
    try {
      const res = await inscricoesFetch(`/${candidatoId}/${acao}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acao === 'indeferir' ? { justificativa: motivo } : {}),
      })
      const dados = await res.json().catch(() => null)
      if (!res.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível registrar a decisão.'))
      onDecisao(dados)
    } catch (e) {
      setErro(e.message)
    } finally {
      ocupado.current = false
      setSalvando(false)
    }
  }

  async function decidirDocumento(documentoId, decisao, motivoRecusa) {
    const res = await inscricoesFetch(`/documentos/${documentoId}/decisao/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisao, motivo_recusa: motivoRecusa }),
    })
    const dados = await res.json().catch(() => null)
    if (!res.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível registrar a decisão.'))
    ultimoCandidato.current = dados
    setCandidato(dados)
    onAtualizado(dados)
  }

  function comecarIndeferimento(recusados) {
    textoAutomatico.current = motivoDosRecusados(recusados)
    setMotivo(textoAutomatico.current)
    setIndeferindo(true)
  }

  // Ao fechar o visualizador, o indeferimento acompanha as decisões: abre indicando os
  // documentos recusados ou fecha se todos foram aprovados. Texto editado à mão é mantido.
  function fecharVisualizador() {
    setVisualizando(null)
    const atual = ultimoCandidato.current
    if (atual?.status !== 'PENDENTE') return
    const docs = documentosParaViewer(atual.documentos, atual.aluno_nome)
    const recusadosAgora = docs.filter((documento) => documento.decision === 'REJEITADO')
    const todosRevisados = docs.every((documento) => documento.decision !== 'PENDENTE')
    const textoDoSistema = !indeferindo || motivo === textoAutomatico.current
    if (!textoDoSistema) return
    if (recusadosAgora.length === 0) {
      setIndeferindo(false)
      setMotivo('')
    } else if (todosRevisados) {
      comecarIndeferimento(recusadosAgora)
    }
  }

  function homologar() {
    confirmar({
      title: 'Homologar inscrição?',
      message: 'A inscrição será homologada e o aluno receberá uma notificação no sistema.',
      confirmLabel: 'Homologar',
      tone: 'accent',
      onConfirm: () => decidir('homologar'),
    })
  }

  const pendente = candidato?.status === 'PENDENTE'
  const documentos = candidato?.documentos ?? []
  const docsOk = documentos.length > 0 && documentos.every((d) => d.decisao === 'APROVADO')
  const docsViewer = candidato ? documentosParaViewer(documentos, candidato.aluno_nome) : []
  const recusados = docsViewer.filter((documento) => documento.decision === 'REJEITADO')
  const subtitulo = [
    candidato?.aluno_curso,
    candidato?.aluno_matricula && `Matrícula ${candidato.aluno_matricula}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const rodape =
    pendente &&
    (indeferindo ? (
      <>
        <Button disabled={salvando} onClick={() => setIndeferindo(false)}>
          Voltar
        </Button>
        <Button
          variant="danger"
          disabled={!motivo.trim()}
          loading={salvando}
          onClick={() => decidir('indeferir')}
        >
          Confirmar indeferimento
        </Button>
      </>
    ) : (
      <>
        <Button
          variant="outline"
          disabled={salvando}
          onClick={() => comecarIndeferimento(recusados)}
        >
          Indeferir
        </Button>
        <Button
          variant="accent"
          disabled={!docsOk}
          loading={salvando}
          title={docsOk ? '' : 'Aprove todos os documentos antes de homologar'}
          onClick={homologar}
        >
          Homologar
        </Button>
      </>
    ))

  return (
    <>
      <Drawer
        title={candidato?.aluno_nome ?? 'Análise da inscrição'}
        subtitle={subtitulo || undefined}
        onClose={fechar}
        footer={rodape || undefined}
      >
        <div className="space-y-6 p-5">
          {erro && <Alert tone="error">{erro}</Alert>}
          {carregando && <Carregando texto="Carregando inscrição..." />}
          {candidato && (
            <>
              <div className="flex items-center gap-2">
                <StatusPill status={candidato.status} />
                {candidato.link_lattes && (
                  <a
                    href={candidato.link_lattes}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-900"
                  >
                    Currículo Lattes
                  </a>
                )}
              </div>
              {candidato.justificativa_indeferimento && (
                <Alert tone="error" title="Motivo do indeferimento">
                  {candidato.justificativa_indeferimento}
                </Alert>
              )}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500">Documentos</p>
                  {documentos.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setVisualizando(documentos[0].id)}
                    >
                      <IconEye /> Revisar todos
                    </Button>
                  )}
                </div>
                <DocList docs={docsViewer} onOpen={setVisualizando} />
                {pendente && !docsOk && !indeferindo && (
                  <p className="mt-2 text-xs text-gray-500">
                    Revise e aprove os documentos para liberar a homologação.
                  </p>
                )}
              </section>
              {indeferindo && recusados.length > 0 && (
                <Alert tone="error" title="Documentos recusados">
                  <ul className="mt-1 list-disc pl-5">
                    {recusados.map((documento) => (
                      <li key={documento.id}>
                        {documento.label}: {documento.motivoRecusa}
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
              {indeferindo && (
                <FormField
                  label="Motivo do indeferimento"
                  hint="O candidato verá este texto e poderá interpor recurso."
                >
                  <TextArea
                    rows={4}
                    value={motivo}
                    maxLength={5000}
                    disabled={salvando}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                </FormField>
              )}
            </>
          )}
        </div>
      </Drawer>
      {visualizando && candidato && (
        <DocumentViewer
          docs={docsViewer}
          initialId={visualizando}
          onClose={fecharVisualizador}
          onDecide={pendente ? decidirDocumento : undefined}
        />
      )}
    </>
  )
}
