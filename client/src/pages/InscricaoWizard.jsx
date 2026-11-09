import { useRef, useState } from 'react'
import { inscricoesFetch } from '../api'
import {
  Alert,
  Button,
  Comprovante,
  DocumentViewer,
  FileField,
  FormActions,
  FormField,
  IconDownload,
  IconPlus,
  IconSend,
  Modal,
  Stepper,
  TextInput,
  useToast,
} from '../components'
import { baixarComprovanteInscricao } from '../utils/comprovante'

const MAX_DOCUMENTOS_ADICIONAIS = 5
const PASSOS = ['Documentos', 'Currículo e termos', 'Revisão']

function extrairErro(corpo, mensagemPadrao) {
  if (!corpo) return mensagemPadrao
  return (
    corpo.detail ||
    corpo.bolsa?.[0] ||
    corpo.arquivo?.[0] ||
    corpo.tipo?.[0] ||
    corpo.link_lattes?.[0] ||
    corpo.non_field_errors?.[0] ||
    mensagemPadrao
  )
}

/** Depois do envio: o comprovante com protocolo e o download do PDF (US91). */
function InscricaoEnviada({ inscricao, onFechar }) {
  const [baixando, setBaixando] = useState(false)
  const [erro, setErro] = useState('')

  async function baixar() {
    setBaixando(true)
    setErro('')
    try {
      await baixarComprovanteInscricao(inscricao.id, inscricao.protocolo)
    } catch (e) {
      setErro(e.message)
    } finally {
      setBaixando(false)
    }
  }

  return (
    <Modal
      title="Inscrição enviada"
      description="Guarde seu comprovante. Você será notificado(a) sobre a homologação."
      width={560}
      onClose={onFechar}
    >
      {erro && <Alert tone="error">{erro}</Alert>}
      {inscricao.comprovante && <Comprovante dados={inscricao.comprovante} />}
      <FormActions>
        <Button variant="primary" onClick={baixar} loading={baixando}>
          <IconDownload size={14} /> Baixar PDF
        </Button>
      </FormActions>
    </Modal>
  )
}

/**
 * Inscrição numa bolsa, como no protótipo: documentos, currículo e termos, revisão.
 * O rascunho é criado ao anexar o primeiro documento; o aceite dos termos só é exigido no
 * envio. Com `inscricaoExistente`, continua um rascunho ou edita uma inscrição enviada.
 */
export default function InscricaoWizard({ bolsa, inscricaoExistente, onFechar, onConcluida }) {
  const toast = useToast()
  const jaEnviada = inscricaoExistente?.status === 'PENDENTE'

  const tituloProjeto = bolsa?.projeto_titulo ?? inscricaoExistente?.projeto_titulo
  const descricao = bolsa
    ? `${bolsa.modalidade} · ${bolsa.carga_horaria_semanal}h · ${tituloProjeto}`
    : tituloProjeto
  const editalNome = bolsa?.edital_nome ?? inscricaoExistente?.edital_nome
  const editalLink = bolsa?.edital_link_documento_oficial

  const [passo, setPasso] = useState(0)
  const [inscricaoId, setInscricaoId] = useState(inscricaoExistente?.id ?? null)
  const [termosAceitos, setTermosAceitos] = useState(inscricaoExistente?.termos_aceitos ?? false)
  const [linkLattes, setLinkLattes] = useState(inscricaoExistente?.link_lattes ?? '')
  const [historico, setHistorico] = useState(
    inscricaoExistente?.documentos.find((d) => d.tipo === 'HISTORICO_ESCOLAR') ?? null
  )
  const [matricula, setMatricula] = useState(
    inscricaoExistente?.documentos.find((d) => d.tipo === 'COMPROVANTE_MATRICULA') ?? null
  )
  const [adicionais, setAdicionais] = useState(() => {
    const existentes = (inscricaoExistente?.documentos ?? [])
      .filter((d) => d.tipo === 'ADICIONAL')
      .map((d) => ({ key: crypto.randomUUID(), documento: d }))
    return existentes.length ? existentes : [{ key: crypto.randomUUID(), documento: null }]
  })
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')
  const [visualizando, setVisualizando] = useState(null) // documento da API
  const [enviada, setEnviada] = useState(null) // inscrição devolvida pelo envio
  // Evita criar dois rascunhos se dois arquivos forem anexados ao mesmo tempo.
  const criando = useRef(null)

  async function garantirInscricao() {
    if (inscricaoId) return inscricaoId
    if (!criando.current) {
      criando.current = (async () => {
        const res = await inscricoesFetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bolsa: bolsa.id, termos_aceitos: false }),
        })
        const corpo = await res.json().catch(() => null)
        if (!res.ok) {
          criando.current = null
          throw new Error(extrairErro(corpo, 'Não foi possível iniciar a inscrição.'))
        }
        setInscricaoId(corpo.id)
        return corpo.id
      })()
    }
    return criando.current
  }

  async function enviarDocumento(tipo, arquivo) {
    const id = await garantirInscricao()
    const formData = new FormData()
    formData.append('tipo', tipo)
    formData.append('arquivo', arquivo)
    const res = await inscricoesFetch(`/${id}/documentos/`, { method: 'POST', body: formData })
    const corpo = await res.json().catch(() => null)
    if (!res.ok) throw new Error(extrairErro(corpo, 'Erro ao enviar o arquivo.'))
    return corpo
  }

  async function removerDocumento(documento) {
    await inscricoesFetch(`/documentos/${documento.id}/`, { method: 'DELETE' })
  }

  /** Anexa ou remove (arquivo vazio) o documento de um campo. */
  async function trocarDocumento(tipo, atual, arquivo, guardar) {
    setProcessando(true)
    setErro('')
    try {
      if (!arquivo) {
        if (atual) await removerDocumento(atual)
        guardar(null)
        return
      }
      guardar(await enviarDocumento(tipo, arquivo))
    } catch (e) {
      setErro(e.message)
    } finally {
      setProcessando(false)
    }
  }

  function guardarAdicional(chave) {
    return (documento) =>
      setAdicionais((atuais) =>
        atuais.map((slot) => (slot.key === chave ? { ...slot, documento } : slot))
      )
  }

  async function removerSlot(slot) {
    if (slot.documento) {
      setProcessando(true)
      await removerDocumento(slot.documento).catch(() => null)
      setProcessando(false)
    }
    setAdicionais((atuais) => atuais.filter((item) => item.key !== slot.key))
  }

  async function salvarDados() {
    if (!inscricaoId) return
    const res = await inscricoesFetch(`/${inscricaoId}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link_lattes: linkLattes, termos_aceitos: termosAceitos }),
    })
    const corpo = await res.json().catch(() => null)
    if (!res.ok) throw new Error(extrairErro(corpo, 'Não foi possível salvar.'))
  }

  async function salvarRascunho() {
    setProcessando(true)
    setErro('')
    try {
      await salvarDados()
      if (inscricaoId) {
        toast({
          message: jaEnviada
            ? 'Alterações salvas.'
            : 'Rascunho salvo. Continue depois em Minhas inscrições.',
          tone: 'success',
        })
      }
      onFechar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setProcessando(false)
    }
  }

  async function continuar() {
    if (passo === 1) {
      setProcessando(true)
      setErro('')
      try {
        await salvarDados()
      } catch (e) {
        setErro(e.message)
        setProcessando(false)
        return
      }
      setProcessando(false)
    }
    setPasso((atual) => atual + 1)
  }

  async function enviarInscricao() {
    setProcessando(true)
    setErro('')
    try {
      await salvarDados()
      const res = await inscricoesFetch(`/${inscricaoId}/enviar/`, { method: 'POST' })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extrairErro(corpo, 'Não foi possível enviar a inscrição.'))
      setEnviada(corpo)
    } catch (e) {
      setErro(e.message)
    } finally {
      setProcessando(false)
    }
  }

  if (enviada) {
    return <InscricaoEnviada inscricao={enviada} onFechar={() => onConcluida(enviada)} />
  }

  const obrigatoriosOk = Boolean(historico && matricula)
  const anexados = [
    historico && ['Histórico Escolar', historico],
    matricula && ['Comprovante de Matrícula', matricula],
    ...adicionais
      .filter((slot) => slot.documento)
      .map((slot) => ['Documento adicional', slot.documento]),
  ].filter(Boolean)
  const preview = (documento) => (documento ? () => setVisualizando(documento) : undefined)

  return (
    <Modal title="Inscrição" description={descricao} width={560} onClose={onFechar}>
      <div className="mb-5">
        <Stepper steps={PASSOS} current={passo} />
      </div>
      {jaEnviada && (
        <Alert tone="info">
          Inscrição já enviada. Você pode trocar os documentos e o Lattes enquanto as inscrições
          estiverem abertas.
        </Alert>
      )}
      {erro && <Alert tone="error">{erro}</Alert>}

      {passo === 0 && (
        <>
          <FormField label="Histórico Escolar">
            <FileField
              value={historico?.nome_original || ''}
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={processando}
              onPreview={preview(historico)}
              onChange={(arquivo) =>
                trocarDocumento('HISTORICO_ESCOLAR', historico, arquivo, setHistorico)
              }
            />
          </FormField>
          <FormField label="Comprovante de Matrícula">
            <FileField
              value={matricula?.nome_original || ''}
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={processando}
              onPreview={preview(matricula)}
              onChange={(arquivo) =>
                trocarDocumento('COMPROVANTE_MATRICULA', matricula, arquivo, setMatricula)
              }
            />
          </FormField>
          <FormField label="Documento adicional (opcional)">
            <div className="flex flex-col gap-2">
              {adicionais.map((slot, indice) => (
                <div key={slot.key} className="flex items-center gap-2">
                  <div className="flex-1">
                    <FileField
                      value={slot.documento?.nome_original || ''}
                      accept=".pdf,.jpg,.jpeg,.png"
                      disabled={processando}
                      onPreview={preview(slot.documento)}
                      onChange={(arquivo) =>
                        trocarDocumento(
                          'ADICIONAL',
                          slot.documento,
                          arquivo,
                          guardarAdicional(slot.key)
                        )
                      }
                    />
                  </div>
                  {indice > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => removerSlot(slot)}>
                      Remover
                    </Button>
                  )}
                </div>
              ))}
              {adicionais.length < MAX_DOCUMENTOS_ADICIONAIS && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  disabled={processando}
                  onClick={() =>
                    setAdicionais((atuais) => [
                      ...atuais,
                      { key: crypto.randomUUID(), documento: null },
                    ])
                  }
                >
                  <IconPlus size={13} /> Outro documento
                </Button>
              )}
            </div>
          </FormField>
        </>
      )}

      {passo === 1 && (
        <>
          <FormField
            label="Link do Currículo Lattes"
            hint="Opcional, mas ajuda na análise de currículo."
          >
            <TextInput
              type="url"
              placeholder="http://lattes.cnpq.br/…"
              value={linkLattes}
              onChange={(e) => setLinkLattes(e.target.value)}
            />
          </FormField>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={termosAceitos}
              disabled={jaEnviada}
              onChange={(e) => setTermosAceitos(e.target.checked)}
              className="mt-0.5 accent-brand"
            />
            <span>
              Declaro que as informações são verdadeiras e que li o edital{' '}
              {editalLink ? (
                <a href={editalLink} target="_blank" rel="noopener noreferrer">
                  {editalNome}
                </a>
              ) : (
                editalNome
              )}
              , os pré-requisitos e a metodologia de avaliação desta bolsa.
            </span>
          </label>
        </>
      )}

      {passo === 2 && (
        <dl className="space-y-3 rounded-lg border border-gray-200 p-4">
          {anexados.map(([rotulo, documento]) => (
            <div key={documento.id} className="flex justify-between gap-4 text-sm">
              <dt className="text-gray-500">{rotulo}</dt>
              <dd className="truncate font-medium text-gray-900">{documento.nome_original}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-gray-500">Lattes</dt>
            <dd className="truncate font-medium text-gray-900">{linkLattes || 'Não informado'}</dd>
          </div>
        </dl>
      )}

      <FormActions>
        {passo > 0 && (
          <Button variant="ghost" onClick={() => setPasso(passo - 1)} disabled={processando}>
            Voltar
          </Button>
        )}
        <Button onClick={salvarRascunho} disabled={processando}>
          {jaEnviada ? 'Salvar e fechar' : 'Salvar rascunho'}
        </Button>
        {passo < 2 ? (
          <Button
            variant="primary"
            disabled={
              processando || (passo === 0 && !obrigatoriosOk) || (passo === 1 && !termosAceitos)
            }
            onClick={continuar}
          >
            Continuar
          </Button>
        ) : jaEnviada ? (
          <Button variant="primary" onClick={salvarRascunho} loading={processando}>
            Salvar alterações
          </Button>
        ) : (
          <Button variant="accent" onClick={enviarInscricao} loading={processando}>
            <IconSend size={14} /> Enviar inscrição
          </Button>
        )}
      </FormActions>

      {visualizando && (
        <DocumentViewer
          docs={[
            {
              id: visualizando.id,
              label: visualizando.tipo_display,
              fileName: visualizando.nome_original,
              url: visualizando.arquivo,
            },
          ]}
          onClose={() => setVisualizando(null)}
        />
      )}
    </Modal>
  )
}
