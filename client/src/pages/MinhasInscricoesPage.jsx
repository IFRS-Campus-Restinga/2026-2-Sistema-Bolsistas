import { useEffect, useState } from 'react'
import { inscricoesFetch } from '../api'
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
import InscricaoWizard from './InscricaoWizard'

export default function MinhasInscricoesPage() {
  const confirmar = useConfirm()
  const toast = useToast()

  const [inscricoes, setInscricoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [recarregar, setRecarregar] = useState(0)
  const [edicaoAberta, setEdicaoAberta] = useState(null)
  const [comprovante, setComprovante] = useState(null)

  useEffect(() => {
    let ativo = true

    async function carregarInscricoes() {
      setCarregando(true)
      setErro('')
      try {
        const res = await inscricoesFetch('/')
        if (!res.ok) throw new Error('Não foi possível carregar suas inscrições.')
        const dados = await res.json()
        if (ativo) setInscricoes(dados)
      } catch (e) {
        if (ativo) setErro(e.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarInscricoes()

    return () => {
      ativo = false
    }
  }, [recarregar])

  function forcarRecarga() {
    setRecarregar((n) => n + 1)
  }

  function cancelarInscricao(inscricao) {
    confirmar({
      title: 'Cancelar inscrição',
      message: 'Tem certeza que deseja cancelar esta inscrição? Essa ação não pode ser desfeita.',
      confirmLabel: 'Cancelar Inscrição',
      tone: 'danger',
      onConfirm: async () => {
        const res = await inscricoesFetch(`/${inscricao.id}/cancelar/`, { method: 'POST' })
        if (res.ok) {
          toast({ message: 'Inscrição cancelada.', tone: 'success' })
          forcarRecarga()
        } else {
          const corpo = await res.json().catch(() => null)
          toast({ message: corpo?.detail || 'Erro ao cancelar inscrição.', tone: 'error' })
        }
      },
    })
  }

  function excluirRascunho(inscricao) {
    confirmar({
      title: 'Cancelar inscrição',
      message:
        'Tem certeza? O rascunho e os documentos já anexados serão descartados definitivamente.',
      confirmLabel: 'Cancelar Inscrição',
      tone: 'danger',
      onConfirm: async () => {
        const res = await inscricoesFetch(`/${inscricao.id}/`, { method: 'DELETE' })
        if (res.ok) {
          toast({ message: 'Rascunho descartado.', tone: 'success' })
          forcarRecarga()
        } else {
          const corpo = await res.json().catch(() => null)
          toast({ message: corpo?.detail || 'Erro ao cancelar inscrição.', tone: 'error' })
        }
      },
    })
  }

  function acoesPorInscricao(inscricao) {
    if (inscricao.status === 'RASCUNHO') {
      return [
        { label: 'Continuar', onClick: () => setEdicaoAberta(inscricao) },
        { label: 'Cancelar', variant: 'danger', onClick: () => excluirRascunho(inscricao) },
      ]
    }
    if (inscricao.status === 'PENDENTE') {
      return [
        { label: 'Ver comprovante', onClick: () => setComprovante(inscricao) },
        { label: 'Editar', onClick: () => setEdicaoAberta(inscricao) },
        { label: 'Cancelar', variant: 'danger', onClick: () => cancelarInscricao(inscricao) },
      ]
    }
    return []
  }

  const linhas = inscricoes.map((inscricao) => [
    inscricao.projeto_titulo,
    inscricao.bolsa_tipo_display,
    inscricao.edital_nome,
    <Badge key="status" status={inscricao.status} />,
    <AcoesCell key="acoes" acoes={acoesPorInscricao(inscricao)} />,
  ])

  return (
    <>
      <PageHeader title="Minhas Inscrições" />

      {erro && <Alert tone="error">{erro}</Alert>}

      {carregando ? (
        <p role="status">Carregando inscrições...</p>
      ) : (
        <DataTable
          columns={['Projeto', 'Tipo', 'Edital', 'Status', 'Ações']}
          rows={linhas}
          emptyMessage="Você ainda não tem nenhuma inscrição."
        />
      )}

      {edicaoAberta && (
        <InscricaoWizard
          inscricaoExistente={edicaoAberta}
          onFechar={() => {
            setEdicaoAberta(null)
            forcarRecarga()
          }}
          onConcluida={() => {
            setEdicaoAberta(null)
            forcarRecarga()
          }}
        />
      )}

      {comprovante && (
        <ComprovanteModal inscricao={comprovante} onFechar={() => setComprovante(null)} />
      )}
    </>
  )
}

function ComprovanteModal({ inscricao, onFechar }) {
  return (
    <Modal title={`Comprovante — ${inscricao.projeto_titulo}`} onClose={onFechar} width={500}>
      <p>
        <strong>Edital:</strong> {inscricao.edital_nome}
      </p>
      <p>
        <strong>Status:</strong> <Badge status={inscricao.status} />
      </p>
      <p>
        <strong>Enviada em:</strong>{' '}
        {inscricao.data_envio ? new Date(inscricao.data_envio).toLocaleString('pt-BR') : '—'}
      </p>

      <p style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Documentos enviados:</p>
      <ul style={{ paddingLeft: 20 }}>
        {inscricao.documentos.map((doc) => (
          <li key={doc.id}>
            <a href={doc.arquivo} target="_blank" rel="noopener noreferrer">
              {doc.tipo_display}: {doc.nome_original}
            </a>
          </li>
        ))}
      </ul>

      {inscricao.link_lattes && (
        <p style={{ marginTop: 8 }}>
          <strong>Lattes:</strong>{' '}
          <a href={inscricao.link_lattes} target="_blank" rel="noopener noreferrer">
            {inscricao.link_lattes}
          </a>
        </p>
      )}

      <FormActions>
        <Button variant="outline" onClick={onFechar}>
          Fechar
        </Button>
      </FormActions>
    </Modal>
  )
}
