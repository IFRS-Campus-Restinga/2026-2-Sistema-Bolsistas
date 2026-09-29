import { useEffect, useRef, useState } from 'react'
import { inscricoesFetch } from '../api'
import {
  Alert,
  Badge,
  Button,
  FormActions,
  FormField,
  Modal,
  TextArea,
  useConfirm,
  useToast,
} from '../components'

function mensagemErro(dados, padrao) {
  if (dados?.detail) return dados.detail
  const valores = Object.values(dados || {}).flat()
  return valores.filter((item) => typeof item === 'string').join(' ') || padrao
}

function dataLocal(data) {
  return data ? data.split('-').reverse().join('/') : 'Não definida'
}

export default function RecursosModal({ inscricaoId, coordenador = false, onFechar, onAtualizar }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [anexos, setAnexos] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [julgamento, setJulgamento] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [campoArquivo, setCampoArquivo] = useState(0)
  const ocupado = useRef(false)
  const confirmar = useConfirm()
  const toast = useToast()

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const res = await inscricoesFetch(`/${inscricaoId}/recursos/`)
        const resultado = await res.json().catch(() => null)
        if (!res.ok || !Array.isArray(resultado?.recursos))
          throw new Error(mensagemErro(resultado, 'Não foi possível carregar os recursos.'))
        if (ativo) setDados(resultado)
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
  }, [inscricaoId, tentativa])

  function fechar() {
    if (ocupado.current) return
    if (justificativa.trim() || anexos.length || motivo.trim()) {
      confirmar({
        title: 'Descartar alterações?',
        message: 'Os dados ainda não enviados serão perdidos.',
        confirmLabel: 'Descartar',
        tone: 'danger',
        onConfirm: onFechar,
      })
    } else onFechar()
  }

  async function executar(path, options, sucesso) {
    if (ocupado.current) return
    ocupado.current = true
    setSalvando(true)
    setErro('')
    try {
      const res = await inscricoesFetch(path, options)
      const resultado = await res.json().catch(() => null)
      if (!res.ok) throw new Error(mensagemErro(resultado, 'Não foi possível concluir a operação.'))
      setDados(resultado)
      setJustificativa('')
      setAnexos([])
      setCampoArquivo((atual) => atual + 1)
      setJulgamento(null)
      setMotivo('')
      onAtualizar(resultado.inscricao)
      toast({ message: sucesso, tone: 'success' })
    } catch (e) {
      setErro(e.message)
    } finally {
      ocupado.current = false
      setSalvando(false)
    }
  }

  function enviar(event) {
    event.preventDefault()
    if (anexos.length > 5) {
      setErro('Selecione no máximo cinco arquivos.')
      return
    }
    const body = new FormData()
    body.append('justificativa', justificativa)
    anexos.forEach((arquivo) => body.append('anexos', arquivo))
    executar(`/${inscricaoId}/recursos/`, { method: 'POST', body }, 'Recurso enviado para análise.')
  }

  function julgar(recurso, decisao, texto = '') {
    executar(
      `/recursos/${recurso.id}/julgar/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, justificativa: texto }),
      },
      'Julgamento registrado. O aluno foi notificado.'
    )
  }

  function deferir(recurso) {
    confirmar({
      title: 'Deferir recurso?',
      message:
        'A inscrição será homologada. Confirme que analisou os documentos originais e os anexos do recurso.',
      confirmLabel: 'Deferir e homologar',
      tone: 'accent',
      onConfirm: () => julgar(recurso, 'DEFERIDO'),
    })
  }

  return (
    <Modal title="Recursos da homologação" onClose={fechar} width={800}>
      <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: 4 }}>
        {erro && <Alert tone="error">{erro}</Alert>}
        {carregando ? (
          <p role="status">Carregando recursos...</p>
        ) : !dados ? (
          <Button
            onClick={() => {
              setErro('')
              setCarregando(true)
              setTentativa((atual) => atual + 1)
            }}
          >
            Tentar novamente
          </Button>
        ) : (
          <>
            <p>
              <strong>Inscrição #{dados.inscricao.id}:</strong> {dados.inscricao.aluno_nome}{' '}
              <Badge status={dados.inscricao.status} />
            </p>
            <p>
              Período de envio: {dataLocal(dados.inicio)} até {dataLocal(dados.fim)}.
            </p>
            {dados.inscricao.justificativa_indeferimento && (
              <Alert tone="warning">
                Motivo do indeferimento: {dados.inscricao.justificativa_indeferimento}
              </Alert>
            )}
            <details>
              <summary>Documentos originais da inscrição</summary>
              <ul>
                {dados.inscricao.documentos.map((doc) => (
                  <li key={doc.id}>
                    <a href={doc.arquivo} target="_blank" rel="noopener noreferrer">
                      {doc.tipo_display}: {doc.nome_original || 'Baixar documento'}
                    </a>
                  </li>
                ))}
              </ul>
              {dados.inscricao.link_lattes && (
                <a href={dados.inscricao.link_lattes} target="_blank" rel="noopener noreferrer">
                  Currículo Lattes
                </a>
              )}
            </details>
            {!coordenador &&
              (dados.pode_enviar ? (
                <form onSubmit={enviar}>
                  <h3>Novo recurso</h3>
                  <p>
                    Explique todas as pendências que deseja contestar. Você pode anexar até cinco
                    documentos novos ou corrigidos. Os arquivos originais serão preservados.
                  </p>
                  <FormField label="Justificativa do recurso">
                    <TextArea
                      aria-label="Justificativa do recurso"
                      rows={4}
                      required
                      maxLength={5000}
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      disabled={salvando}
                    />
                  </FormField>
                  <FormField label="Anexos opcionais">
                    <input
                      key={campoArquivo}
                      aria-label="Anexos do recurso"
                      type="file"
                      multiple
                      disabled={salvando}
                      onChange={(e) => {
                        setAnexos(Array.from(e.target.files || []))
                        setErro('')
                      }}
                    />
                  </FormField>
                  <p>{anexos.length} de 5 arquivos selecionados.</p>
                  {anexos.length > 5 && (
                    <Alert tone="error">Selecione no máximo cinco arquivos.</Alert>
                  )}
                  <FormActions>
                    <Button
                      type="submit"
                      variant="accent"
                      disabled={salvando || !justificativa.trim() || anexos.length > 5}
                    >
                      {salvando ? 'Enviando...' : 'Enviar recurso'}
                    </Button>
                  </FormActions>
                </form>
              ) : (
                <p>{dados.motivo_bloqueio}</p>
              ))}
            <h3>Histórico de recursos</h3>
            {dados.recursos.length === 0 && <p>Nenhum recurso enviado nesta etapa.</p>}
            {dados.recursos.map((recurso) => (
              <section
                key={recurso.id}
                style={{ borderTop: '1px solid #d9d9d9', paddingTop: 12, marginTop: 12 }}
              >
                <h4>
                  Recurso #{recurso.id} <Badge status={recurso.status} />
                </h4>
                <p>Enviado em {new Date(recurso.criado_em).toLocaleString('pt-BR')}.</p>
                <p style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>Motivo contestado:</strong> {recurso.motivo_contestado || 'Não informado'}
                </p>
                <p style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>Justificativa do aluno:</strong> {recurso.justificativa}
                </p>
                <ul>
                  {recurso.anexos.map((anexo) => (
                    <li key={anexo.id}>
                      <a href={anexo.arquivo} target="_blank" rel="noopener noreferrer">
                        {anexo.nome_original}
                      </a>
                    </li>
                  ))}
                </ul>
                {recurso.anexos.length === 0 && <p>Sem anexos neste recurso.</p>}
                {recurso.julgado_em && (
                  <p>Julgado em {new Date(recurso.julgado_em).toLocaleString('pt-BR')}.</p>
                )}
                {recurso.justificativa_julgamento && (
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    <strong>Justificativa do julgamento:</strong> {recurso.justificativa_julgamento}
                  </p>
                )}
                {coordenador &&
                  recurso.status === 'PENDENTE' &&
                  (julgamento === recurso.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        julgar(recurso, 'INDEFERIDO', motivo)
                      }}
                    >
                      <FormField label="Motivo do indeferimento do recurso">
                        <TextArea
                          aria-label="Motivo do indeferimento do recurso"
                          required
                          rows={3}
                          maxLength={5000}
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          disabled={salvando}
                        />
                      </FormField>
                      <FormActions>
                        <Button disabled={salvando} onClick={() => setJulgamento(null)}>
                          Voltar
                        </Button>
                        <Button
                          type="submit"
                          variant="danger"
                          disabled={salvando || !motivo.trim()}
                        >
                          Confirmar indeferimento
                        </Button>
                      </FormActions>
                    </form>
                  ) : (
                    <FormActions>
                      <Button
                        variant="danger"
                        disabled={salvando}
                        onClick={() => {
                          setJulgamento(recurso.id)
                          setMotivo('')
                        }}
                      >
                        Indeferir recurso
                      </Button>
                      <Button variant="accent" disabled={salvando} onClick={() => deferir(recurso)}>
                        Deferir recurso
                      </Button>
                    </FormActions>
                  ))}
              </section>
            ))}
          </>
        )}
      </div>
      <FormActions>
        <Button disabled={salvando} onClick={fechar}>
          Fechar
        </Button>
      </FormActions>
    </Modal>
  )
}
