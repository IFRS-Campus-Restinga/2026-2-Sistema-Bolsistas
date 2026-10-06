import { useEffect, useState } from 'react'
import { vinculoDiretoFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  DataTable,
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
  const [detalhe, setDetalhe] = useState(null)

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
    return [{ label: 'Ver Detalhes', onClick: () => setDetalhe(convite) }]
  }

  const linhas = convites.map((convite) => [
    convite.projeto_titulo,
    convite.edital_nome,
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

      {detalhe && (
        <Modal title="Detalhes do convite" onClose={() => setDetalhe(null)} width={520}>
          <p>
            <strong>Projeto:</strong> {detalhe.projeto_titulo}
          </p>
          <p>
            <strong>Edital:</strong> {detalhe.edital_nome}
          </p>
          <p>
            <strong>Status:</strong> <Badge status={detalhe.status} />
          </p>
          {detalhe.status === 'REJEITADO' && detalhe.justificativa_rejeicao && (
            <Alert tone="error">Motivo: {detalhe.justificativa_rejeicao}</Alert>
          )}
          {detalhe.status === 'APROVADO' && (
            <Alert tone="success">Vínculo direto aprovado — bolsa efetivada.</Alert>
          )}
        </Modal>
      )}
    </>
  )
}
