import { useEffect, useState } from 'react'
import { vinculoDiretoFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  Button,
  DataTable,
  FormActions,
  Modal,
  PageHeader,
  useConfirm,
  useToast,
} from '../components'
import PreencherConviteModal from './PreencherConviteModal'

export default function ConvitesPage() {
  const confirmar = useConfirm()
  const toast = useToast()

  const [convites, setConvites] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)

  const [edicaoAberta, setEdicaoAberta] = useState(null)
  const [comprovante, setComprovante] = useState(null)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        const res = await vinculoDiretoFetch('/meus-convites/')
        if (!res.ok) throw new Error('Não foi possível carregar seus convites.')
        const dados = await res.json()
        if (ativo) setConvites(Array.isArray(dados) ? dados : [])
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
  }, [tentativa])

  function atualizarConvite(convite) {
    setConvites((atuais) => atuais.map((item) => (item.id === convite.id ? convite : item)))
  }

  function aceitar(convite) {
    confirmar({
      title: 'Aceitar convite?',
      message:
        'Você poderá preencher a documentação em seguida, nas mesmas condições de uma inscrição normal.',
      confirmLabel: 'Aceitar',
      tone: 'accent',
      onConfirm: async () => {
        const res = await vinculoDiretoFetch(`/convites/${convite.id}/aceitar/`, { method: 'POST' })
        const dados = await res.json().catch(() => null)
        if (res.ok) {
          atualizarConvite(dados)
          toast({ message: 'Convite aceito. Preencha a documentação.', tone: 'success' })
          setEdicaoAberta(dados)
        } else {
          toast({ message: dados?.detail || 'Erro ao aceitar convite.', tone: 'error' })
        }
      },
    })
  }

  function recusar(convite) {
    confirmar({
      title: 'Recusar convite?',
      message: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Recusar Convite',
      tone: 'danger',
      onConfirm: async () => {
        const res = await vinculoDiretoFetch(`/convites/${convite.id}/recusar/`, { method: 'POST' })
        const dados = await res.json().catch(() => null)
        if (res.ok) {
          atualizarConvite(dados)
          toast({ message: 'Convite recusado.', tone: 'success' })
        } else {
          toast({ message: dados?.detail || 'Erro ao recusar convite.', tone: 'error' })
        }
      },
    })
  }

  function acoesPorConvite(convite) {
    if (convite.status === 'PENDENTE') {
      return [
        { label: 'Aceitar', variant: 'accent', onClick: () => aceitar(convite) },
        { label: 'Recusar', variant: 'danger', onClick: () => recusar(convite) },
      ]
    }
    if (convite.status === 'EM_PREENCHIMENTO') {
      return [
        {
          label: 'Preencher Documentação',
          variant: 'accent',
          onClick: () => setEdicaoAberta(convite),
        },
      ]
    }
    if (convite.status === 'ENVIADO') {
      return [
        { label: 'Ver Comprovante', onClick: () => setComprovante(convite) },
        { label: 'Editar Documentação', onClick: () => setEdicaoAberta(convite) },
      ]
    }
    return [{ label: 'Ver Comprovante', onClick: () => setComprovante(convite) }]
  }

  const linhas = convites.map((convite) => [
    convite.projeto_titulo,
    convite.edital_link_documento_oficial ? (
      <a
        key="edital"
        href={convite.edital_link_documento_oficial}
        target="_blank"
        rel="noopener noreferrer"
      >
        {convite.edital_nome}
      </a>
    ) : (
      convite.edital_nome
    ),
    convite.bolsa_tipo_display,
    <Badge key="status" status={convite.status} />,
    <AcoesCell key="acoes" acoes={acoesPorConvite(convite)} />,
  ])

  return (
    <>
      <PageHeader title="Convites de Vínculo Direto" />
      {erro && (
        <Alert tone="error">
          {erro}{' '}
          <button type="button" onClick={() => setTentativa((n) => n + 1)}>
            Tentar novamente
          </button>
        </Alert>
      )}

      {carregando ? (
        <p role="status">Carregando convites...</p>
      ) : (
        <DataTable
          columns={['Projeto', 'Edital', 'Tipo', 'Status', 'Ações']}
          rows={linhas}
          emptyMessage="Você não recebeu nenhum convite de vínculo direto."
        />
      )}

      {edicaoAberta && (
        <PreencherConviteModal
          convite={edicaoAberta}
          onFechar={() => setEdicaoAberta(null)}
          onAtualizado={(convite) => {
            atualizarConvite(convite)
            setEdicaoAberta(convite)
          }}
          onEnviado={(convite) => {
            atualizarConvite(convite)
            setEdicaoAberta(null)
          }}
        />
      )}

      {comprovante && (
        <ComprovanteConviteModal convite={comprovante} onFechar={() => setComprovante(null)} />
      )}
    </>
  )
}

function ComprovanteConviteModal({ convite, onFechar }) {
  return (
    <Modal title={`Comprovante ${convite.projeto_titulo}`} onClose={onFechar} width={500}>
      <p>
        <strong>Edital:</strong>{' '}
        {convite.edital_link_documento_oficial ? (
          <a href={convite.edital_link_documento_oficial} target="_blank" rel="noopener noreferrer">
            {convite.edital_nome}
          </a>
        ) : (
          convite.edital_nome
        )}
      </p>
      <p>
        <strong>Status:</strong> <Badge status={convite.status} />
      </p>
      <p>
        <strong>Enviada em:</strong>{' '}
        {convite.data_envio_documentos
          ? new Date(convite.data_envio_documentos).toLocaleString('pt-BR')
          : '—'}
      </p>

      {convite.status === 'REJEITADO' && convite.justificativa_rejeicao && (
        <Alert tone="error">Motivo da rejeição: {convite.justificativa_rejeicao}</Alert>
      )}
      {convite.status === 'APROVADO' && (
        <Alert tone="success">Vínculo direto aprovado, bolsa efetivada.</Alert>
      )}
      {convite.data_decisao && (
        <p>Decisão registrada em {new Date(convite.data_decisao).toLocaleString('pt-BR')}.</p>
      )}

      <p style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Documentos enviados:</p>
      {convite.documentos.length ? (
        <ul style={{ paddingLeft: 20 }}>
          {convite.documentos.map((doc) => (
            <li key={doc.id}>
              <a href={doc.arquivo} target="_blank" rel="noopener noreferrer">
                {doc.tipo_display}: {doc.nome_original}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhum documento enviado.</p>
      )}

      {convite.link_lattes && (
        <p>
          <strong>Lattes:</strong>{' '}
          <a href={convite.link_lattes} target="_blank" rel="noopener noreferrer">
            {convite.link_lattes}
          </a>
        </p>
      )}

      <FormActions>
        <Button variant="danger" onClick={onFechar}>
          Fechar
        </Button>
      </FormActions>
    </Modal>
  )
}
