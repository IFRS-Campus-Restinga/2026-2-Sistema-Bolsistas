import { useEffect, useRef, useState } from 'react'
import { vinculoDiretoFetch } from '../api'
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

export default function RevisarConviteModal({ conviteId, onFechar, onDecisao }) {
  const [convite, setConvite] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [rejeitando, setRejeitando] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const ocupado = useRef(false)
  const confirmar = useConfirm()

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const res = await vinculoDiretoFetch(`/convites/${conviteId}/coordenador/`)
        const dados = await res.json().catch(() => null)
        if (!res.ok || !dados)
          throw new Error(dados?.detail || 'Não foi possível carregar o convite.')
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

  function fechar() {
    if (!ocupado.current) onFechar()
  }

  async function aprovar() {
    if (ocupado.current) return
    ocupado.current = true
    setSalvando(true)
    setErro('')
    try {
      const res = await vinculoDiretoFetch(`/convites/${conviteId}/aprovar/`, { method: 'POST' })
      const dados = await res.json().catch(() => null)
      if (!res.ok) throw new Error(dados?.detail || 'Não foi possível aprovar o convite.')
      onDecisao(dados)
    } catch (e) {
      setErro(e.message)
    } finally {
      ocupado.current = false
      setSalvando(false)
    }
  }

  async function rejeitar(definitivo) {
    if (ocupado.current) return
    ocupado.current = true
    setSalvando(true)
    setErro('')
    try {
      const res = await vinculoDiretoFetch(`/convites/${conviteId}/rejeitar/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificativa, definitivo }),
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

  function confirmarAprovar() {
    confirmar({
      title: 'Aprovar vínculo direto?',
      message:
        'A bolsa será efetivada para este aluno e o Coordenador de Área será notificado. Esta ação não pode ser desfeita.',
      confirmLabel: 'Aprovar',
      tone: 'accent',
      onConfirm: aprovar,
    })
  }

  return (
    <Modal title="Revisar Documentação do Convite" onClose={fechar} width={720}>
      <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
        {erro && <Alert tone="error">{erro}</Alert>}
        {carregando ? (
          <p role="status">Carregando convite...</p>
        ) : (
          convite && (
            <>
              <p>
                <strong>Projeto:</strong> {convite.projeto_titulo}
              </p>
              <p>
                <strong>Edital:</strong>{' '}
                {convite.edital_link_documento_oficial ? (
                  <a
                    href={convite.edital_link_documento_oficial}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {convite.edital_nome}
                  </a>
                ) : (
                  convite.edital_nome
                )}
              </p>
              <p>
                <strong>Aluno:</strong> {convite.aluno_nome}
              </p>
              <p>
                <strong>E-mail:</strong> {convite.aluno_email || 'Não informado'}
              </p>
              <p>
                <strong>Status:</strong> <Badge status={convite.status} />
              </p>
              <h4>Documentos enviados</h4>
              {convite.documentos.length ? (
                <ul>
                  {convite.documentos.map((doc) => (
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
              {convite.link_lattes && (
                <p>
                  <a href={convite.link_lattes} target="_blank" rel="noopener noreferrer">
                    Currículo Lattes
                  </a>
                </p>
              )}
              {convite.justificativa_rejeicao && (
                <Alert tone="warning">
                  Última justificativa registrada: {convite.justificativa_rejeicao}
                </Alert>
              )}
              {rejeitando && convite.status === 'ENVIADO' && (
                <FormField label="Justificativa (obrigatória)">
                  <TextArea
                    aria-label="Justificativa da rejeição"
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    required
                    maxLength={5000}
                    rows={4}
                    disabled={salvando}
                  />
                </FormField>
              )}
            </>
          )
        )}
      </div>
      <FormActions>
        {!rejeitando && (
          <Button
            variant={convite?.status === 'ENVIADO' ? 'outline' : 'danger'}
            onClick={fechar}
            disabled={salvando}
          >
            Fechar
          </Button>
        )}
        {convite?.status === 'ENVIADO' && !rejeitando && (
          <>
            <Button variant="danger" disabled={salvando} onClick={() => setRejeitando(true)}>
              Rejeitar
            </Button>
            <Button variant="accent" disabled={salvando} onClick={confirmarAprovar}>
              {salvando ? 'Salvando...' : 'Aprovar'}
            </Button>
          </>
        )}
        {rejeitando && (
          <>
            <Button disabled={salvando} onClick={() => setRejeitando(false)}>
              Voltar
            </Button>
            <Button
              variant="outline"
              disabled={salvando || !justificativa.trim()}
              onClick={() => rejeitar(false)}
            >
              Solicitar Reenvio
            </Button>
            <Button
              variant="danger"
              disabled={salvando || !justificativa.trim()}
              onClick={() => rejeitar(true)}
            >
              Rejeitar Definitivamente
            </Button>
          </>
        )}
      </FormActions>
    </Modal>
  )
}
