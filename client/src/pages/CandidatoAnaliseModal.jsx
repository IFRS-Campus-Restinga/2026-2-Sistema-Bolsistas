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
} from '../components'

export default function CandidatoAnaliseModal({ candidatoId, onFechar, onDecisao }) {
  const [candidato, setCandidato] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [indeferindo, setIndeferindo] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const ocupado = useRef(false)
  const confirmar = useConfirm()

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const res = await inscricoesFetch(`/candidatos/${candidatoId}/`)
        const dados = await res.json().catch(() => null)
        if (!res.ok || !dados)
          throw new Error(dados?.detail || 'Não foi possível carregar a inscrição.')
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
    if (justificativa.trim()) {
      confirmar({
        title: 'Descartar justificativa?',
        message: 'A justificativa não salva será perdida.',
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
        body: JSON.stringify(acao === 'indeferir' ? { justificativa } : {}),
      })
      const dados = await res.json().catch(() => null)
      if (!res.ok)
        throw new Error(
          dados?.justificativa?.[0] || dados?.detail || 'Não foi possível registrar a decisão.'
        )
      onDecisao(dados)
    } catch (e) {
      setErro(e.message)
    } finally {
      ocupado.current = false
      setSalvando(false)
    }
  }

  function homologar() {
    confirmar({
      title: 'Homologar inscrição?',
      message:
        'Confirme que você analisou os documentos. A inscrição será homologada e o aluno receberá uma notificação no sistema.',
      confirmLabel: 'Homologar',
      tone: 'accent',
      onConfirm: () => decidir('homologar'),
    })
  }

  return (
    <Modal title="Análise da inscrição" onClose={fechar} width={720}>
      <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
        {erro && <Alert tone="error">{erro}</Alert>}
        {carregando ? (
          <p role="status">Carregando inscrição...</p>
        ) : (
          candidato && (
            <>
              <p>
                <strong>Candidato:</strong> {candidato.aluno_nome}
              </p>
              <p>
                <strong>E-mail:</strong> {candidato.aluno_email || 'Não informado'}
              </p>
              <p>
                <strong>Status:</strong> <Badge status={candidato.status} />
              </p>
              <p>A decisão só pode ser registrada após o encerramento das inscrições do edital.</p>
              <h4>Documentos enviados</h4>
              {candidato.documentos.length ? (
                <ul>
                  {candidato.documentos.map((doc) => (
                    <li key={doc.id}>
                      <a href={doc.arquivo} target="_blank" rel="noopener noreferrer">
                        {doc.tipo_display}: {doc.nome_original || 'Baixar documento'}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nenhum documento enviado.</p>
              )}
              {!candidato.documentacao_completa && (
                <Alert tone="warning">
                  Faltam documentos obrigatórios. A inscrição não pode ser homologada.
                </Alert>
              )}
              {candidato.link_lattes && (
                <p>
                  <a href={candidato.link_lattes} target="_blank" rel="noopener noreferrer">
                    Currículo Lattes
                  </a>
                </p>
              )}
              {candidato.justificativa_indeferimento && (
                <Alert tone="error">
                  Motivo do indeferimento: {candidato.justificativa_indeferimento}
                </Alert>
              )}
              {candidato.data_decisao && (
                <p>
                  Decisão registrada em {new Date(candidato.data_decisao).toLocaleString('pt-BR')}.
                </p>
              )}
              {indeferindo && candidato.status === 'PENDENTE' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    decidir('indeferir')
                  }}
                >
                  <FormField label="Justificativa do indeferimento (obrigatória)">
                    <TextArea
                      aria-label="Justificativa do indeferimento"
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      required
                      maxLength={5000}
                      rows={4}
                      disabled={salvando}
                    />
                  </FormField>
                  <FormActions>
                    <Button disabled={salvando} onClick={() => setIndeferindo(false)}>
                      Voltar à análise
                    </Button>
                    <Button
                      type="submit"
                      variant="danger"
                      disabled={salvando || !justificativa.trim()}
                    >
                      {salvando ? 'Salvando...' : 'Confirmar indeferimento'}
                    </Button>
                  </FormActions>
                </form>
              )}
            </>
          )
        )}
      </div>
      <FormActions>
        <Button onClick={fechar} disabled={salvando}>
          Fechar
        </Button>
        {candidato?.status === 'PENDENTE' && !indeferindo && (
          <>
            <Button variant="danger" disabled={salvando} onClick={() => setIndeferindo(true)}>
              Indeferir
            </Button>
            <Button
              variant="accent"
              disabled={salvando || !candidato.documentacao_completa}
              onClick={homologar}
            >
              {salvando ? 'Salvando...' : 'Homologar'}
            </Button>
          </>
        )}
      </FormActions>
    </Modal>
  )
}
