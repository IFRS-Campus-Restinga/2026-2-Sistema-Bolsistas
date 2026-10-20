import { useEffect, useState } from 'react'
import { bolsasFetch, vinculoDiretoFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  Button,
  DataTable,
  FormActions,
  FormField,
  Modal,
  PageHeader,
  TextArea,
  useConfirm,
  useToast,
} from '../components'

const TIPO_LABEL = {
  ENSINO: 'Ensino',
  PESQUISA: 'Pesquisa',
  EXTENSAO: 'Extensão',
  INDISSOCIAVEL: 'Indissociável',
}

export default function SolicitacoesBolsaPage() {
  const confirmar = useConfirm()
  const toast = useToast()

  const [bolsas, setBolsas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [notificacoes, setNotificacoes] = useState([])

  const [modalRejeitar, setModalRejeitar] = useState(null)
  const [justificativa, setJustificativa] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroRejeitar, setErroRejeitar] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregarBolsas() {
      try {
        const res = await bolsasFetch('/')
        if (!res.ok) throw new Error('Não foi possível carregar as bolsas.')
        const dados = await res.json()
        if (ativo) setBolsas(dados)
      } catch (e) {
        if (ativo) setErro(e.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarBolsas()

    vinculoDiretoFetch('/notificacoes/')
      .then((res) => (res.ok ? res.json() : []))
      .then((dados) => {
        if (ativo) setNotificacoes(Array.isArray(dados) ? dados.filter((n) => !n.lida_em) : [])
      })
      .catch(() => {})

    return () => {
      ativo = false
    }
  }, [])

  function atualizarBolsa(atualizada) {
    setBolsas((atuais) => atuais.map((item) => (item.id === atualizada.id ? atualizada : item)))
  }

  async function marcarNotificacaoLida(notificacao) {
    setNotificacoes((atuais) => atuais.filter((item) => item.id !== notificacao.id))
    await vinculoDiretoFetch(`/notificacoes/${notificacao.id}/ler/`, { method: 'POST' }).catch(
      () => null
    )
  }

  function confirmarAprovar(bolsa) {
    confirmar({
      title: 'Aprovar bolsa',
      message:
        'Confirma a aprovação desta bolsa? Ela ficará com inscrições abertas para os alunos.',
      confirmLabel: 'Aprovar',
      tone: 'accent',
      onConfirm: async () => {
        const res = await bolsasFetch(`/${bolsa.id}/aprovar/`, { method: 'POST' })
        if (res.ok) {
          atualizarBolsa(await res.json())
          toast({ message: 'Bolsa aprovada com sucesso.', tone: 'success' })
        } else {
          const corpo = await res.json().catch(() => null)
          toast({ message: corpo?.detail || 'Erro ao aprovar bolsa.', tone: 'error' })
        }
      },
    })
  }

  function abrirModalRejeitar(bolsa) {
    setModalRejeitar(bolsa)
    setJustificativa('')
    setErroRejeitar('')
  }

  async function confirmarRejeitar() {
    setEnviando(true)
    setErroRejeitar('')
    try {
      const res = await bolsasFetch(`/${modalRejeitar.id}/rejeitar/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificativa }),
      })
      if (!res.ok) {
        const corpo = await res.json().catch(() => null)
        throw new Error(corpo?.justificativa?.[0] || corpo?.detail || 'Erro ao rejeitar bolsa.')
      }
      atualizarBolsa(await res.json())
      setModalRejeitar(null)
      toast({ message: 'Bolsa rejeitada.', tone: 'success' })
    } catch (e) {
      setErroRejeitar(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const linhas = bolsas.map((bolsa) => [
    bolsa.projeto_titulo,
    TIPO_LABEL[bolsa.tipo] || bolsa.tipo,
    bolsa.edital_nome,
    bolsa.quantidade_vagas,
    `R$ ${bolsa.valor_mensal}`,
    <Badge key="status" status={bolsa.status} />,
    <AcoesCell
      key="acoes"
      mostrar={bolsa.status === 'SOLICITADA'}
      acoes={[
        { label: 'Aprovar', variant: 'accent', onClick: () => confirmarAprovar(bolsa) },
        { label: 'Rejeitar', variant: 'danger', onClick: () => abrirModalRejeitar(bolsa) },
      ]}
    />,
  ])

  return (
    <>
      <PageHeader title="Solicitações de Bolsa" />

      {notificacoes.map((notificacao) => (
        <Alert key={notificacao.id} tone="success">
          {notificacao.mensagem}{' '}
          <button type="button" onClick={() => marcarNotificacaoLida(notificacao)}>
            Marcar como lida
          </button>
        </Alert>
      ))}

      {erro && <Alert tone="error">{erro}</Alert>}

      <DataTable
        columns={['Projeto', 'Tipo', 'Edital', 'Vagas', 'Valor', 'Status', 'Ações']}
        rows={linhas}
        loading={carregando}
        emptyMessage="Nenhuma bolsa da sua área."
      />

      {modalRejeitar && (
        <Modal title="Rejeitar Solicitação de Bolsa" onClose={() => setModalRejeitar(null)}>
          {erroRejeitar && <Alert tone="error">{erroRejeitar}</Alert>}
          <FormField label="Justificativa (obrigatória)">
            <TextArea
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              required
            />
          </FormField>
          <FormActions>
            <Button variant="outline" onClick={() => setModalRejeitar(null)} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={confirmarRejeitar}
              disabled={!justificativa.trim()}
              loading={enviando}
            >
              Confirmar Rejeição
            </Button>
          </FormActions>
        </Modal>
      )}
    </>
  )
}
