import { useEffect, useRef, useState } from 'react'
import { vinculoDiretoFetch } from '../api'
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

/** Texto inicial da justificativa: cada documento recusado com o motivo. */
function justificativaDosRecusados(recusados) {
  return recusados.map((documento) => `${documento.label}: ${documento.motivoRecusa}`).join('\n')
}

/**
 * Revisão do convite de vínculo direto, no mesmo fluxo da análise do candidato:
 * documentos revisados no visualizador e, no fim, aprovar o vínculo (todos aprovados)
 * ou devolver ao aluno indicando os documentos recusados.
 */
export default function RevisarConviteDrawer({ conviteId, onFechar, onAtualizado, onDecisao }) {
  const [convite, setConvite] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(null)
  const [rejeitando, setRejeitando] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [visualizando, setVisualizando] = useState(null)
  const salvando = acaoEmAndamento !== null
  const ocupado = useRef(false)
  // Versão mais recente, lida ao fechar o visualizador logo após a última decisão.
  const ultimoConvite = useRef(null)
  // Justificativa montada a partir dos recusados, para saber se o coordenador a editou.
  const textoAutomatico = useRef('')
  const confirmar = useConfirm()

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const res = await vinculoDiretoFetch(`/convites/${conviteId}/coordenador/`)
        const dados = await res.json().catch(() => null)
        if (!res.ok || !dados) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar o convite.'))
        }
        ultimoConvite.current = dados
        if (ativo) setConvite(dados)
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
  }, [conviteId])

  const enviado = convite?.status === 'ENVIADO'
  const docsViewer = convite ? documentosParaViewer(convite.documentos, convite.aluno_nome) : []
  const recusados = docsViewer.filter((documento) => documento.decision === 'REJEITADO')
  const revisados =
    docsViewer.length > 0 && docsViewer.every((documento) => documento.decision !== 'PENDENTE')
  const docsOk = revisados && recusados.length === 0

  function fechar() {
    if (!ocupado.current) onFechar()
  }

  function comecarRejeicao(documentosRecusados = recusados) {
    textoAutomatico.current = justificativaDosRecusados(documentosRecusados)
    setJustificativa(textoAutomatico.current)
    setRejeitando(true)
  }

  // Ao fechar o visualizador, a devolução acompanha as decisões: abre indicando os
  // documentos recusados ou fecha se todos foram aprovados. Texto editado à mão é mantido.
  function fecharVisualizador() {
    setVisualizando(null)
    const atual = ultimoConvite.current
    if (atual?.status !== 'ENVIADO') return
    const documentos = documentosParaViewer(atual.documentos, atual.aluno_nome)
    const recusadosAgora = documentos.filter((documento) => documento.decision === 'REJEITADO')
    const todosRevisados = documentos.every((documento) => documento.decision !== 'PENDENTE')
    const textoDoSistema = !rejeitando || justificativa === textoAutomatico.current
    if (!textoDoSistema) return
    if (recusadosAgora.length === 0) {
      setRejeitando(false)
      setJustificativa('')
    } else if (todosRevisados) {
      comecarRejeicao(recusadosAgora)
    }
  }

  async function decidirDocumento(documentoId, decisao, motivoRecusa) {
    const res = await vinculoDiretoFetch(`/documentos/${documentoId}/decisao/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisao, motivo_recusa: motivoRecusa }),
    })
    const dados = await res.json().catch(() => null)
    if (!res.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível registrar a decisão.'))
    ultimoConvite.current = dados
    setConvite(dados)
    onAtualizado(dados)
  }

  async function enviarDecisao(acao, corpo, emAndamento) {
    if (ocupado.current) return
    ocupado.current = true
    setAcaoEmAndamento(emAndamento)
    setErro('')
    try {
      const res = await vinculoDiretoFetch(`/convites/${conviteId}/${acao}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      const dados = await res.json().catch(() => null)
      if (!res.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível registrar a decisão.'))
      onDecisao(dados)
    } catch (e) {
      setErro(e.message)
    } finally {
      ocupado.current = false
      setAcaoEmAndamento(null)
    }
  }

  function aprovar() {
    confirmar({
      title: 'Aprovar vínculo direto?',
      message:
        'A bolsa será efetivada para este aluno e o Coordenador de Área será notificado. Esta ação não pode ser desfeita.',
      confirmLabel: 'Aprovar',
      tone: 'accent',
      onConfirm: () => enviarDecisao('aprovar', {}, 'aprovar'),
    })
  }

  function rejeitar(definitivo) {
    enviarDecisao('rejeitar', { justificativa, definitivo }, definitivo ? 'definitivo' : 'reenvio')
  }

  const subtitulo = convite && `${convite.projeto_titulo} · Edital ${convite.edital_nome}`

  const rodape =
    enviado &&
    (rejeitando ? (
      <>
        <Button disabled={salvando} onClick={() => setRejeitando(false)}>
          Voltar
        </Button>
        <Button
          variant="outline"
          disabled={salvando || !justificativa.trim()}
          loading={acaoEmAndamento === 'reenvio'}
          onClick={() => rejeitar(false)}
        >
          Solicitar reenvio
        </Button>
        <Button
          variant="danger"
          disabled={salvando || !justificativa.trim()}
          loading={acaoEmAndamento === 'definitivo'}
          onClick={() => rejeitar(true)}
        >
          Rejeitar definitivamente
        </Button>
      </>
    ) : (
      <>
        <Button variant="outline" disabled={salvando} onClick={() => comecarRejeicao()}>
          Rejeitar
        </Button>
        <Button
          variant="accent"
          disabled={!docsOk}
          loading={acaoEmAndamento === 'aprovar'}
          title={docsOk ? '' : 'Aprove todos os documentos antes de aprovar o vínculo'}
          onClick={aprovar}
        >
          Aprovar
        </Button>
      </>
    ))

  return (
    <>
      <Drawer
        title={convite?.aluno_nome ?? 'Revisão do convite'}
        subtitle={subtitulo || undefined}
        onClose={fechar}
        footer={rodape || undefined}
      >
        <div className="space-y-6 p-5">
          {erro && <Alert tone="error">{erro}</Alert>}
          {carregando && <Carregando texto="Carregando convite..." />}
          {convite && (
            <>
              <div className="flex items-center gap-2">
                <StatusPill
                  status={convite.status}
                  label={enviado ? 'Documentação enviada' : undefined}
                />
                {convite.link_lattes && (
                  <a
                    href={convite.link_lattes}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-900"
                  >
                    Currículo Lattes
                  </a>
                )}
              </div>
              {convite.justificativa_rejeicao && !rejeitando && (
                <Alert tone="warning" title="Última justificativa enviada ao aluno">
                  {convite.justificativa_rejeicao}
                </Alert>
              )}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500">Documentos</p>
                  {docsViewer.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setVisualizando(docsViewer[0].id)}
                    >
                      <IconEye /> Revisar todos
                    </Button>
                  )}
                </div>
                <DocList docs={docsViewer} onOpen={setVisualizando} />
                {enviado && !docsOk && !rejeitando && (
                  <p className="mt-2 text-xs text-gray-500">
                    Revise e aprove os documentos para liberar a aprovação do vínculo.
                  </p>
                )}
              </section>
              {rejeitando && (
                <>
                  {recusados.length > 0 && (
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
                  <FormField
                    label="Justificativa ao aluno"
                    hint="Em Solicitar reenvio, o aluno corrige os documentos e envia de novo. Rejeitar definitivamente encerra o convite."
                  >
                    <TextArea
                      rows={4}
                      value={justificativa}
                      maxLength={5000}
                      disabled={salvando}
                      onChange={(e) => setJustificativa(e.target.value)}
                    />
                  </FormField>
                </>
              )}
            </>
          )}
        </div>
      </Drawer>
      {visualizando && convite && (
        <DocumentViewer
          docs={docsViewer}
          initialId={visualizando}
          onClose={fecharVisualizador}
          onDecide={enviado ? decidirDocumento : undefined}
        />
      )}
    </>
  )
}
