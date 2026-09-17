import { useEffect, useState } from 'react'
import { bolsasFetch } from '../api'
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

    return () => {
      ativo = false
    }
  }, [])

  function atualizarBolsa(atualizada) {
    setBolsas((atuais) => atuais.map((item) => (item.id === atualizada.id ? atualizada : item)))
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
    `R$ ${bolsa.valor_mensal}`,
    <Badge key="status" status={bolsa.status} />,
    <AcoesCell key="acoes" mostrar={bolsa.status === 'SOLICITADA'}>
      <Button size="sm" variant="accent" onClick={() => confirmarAprovar(bolsa)}>
        Aprovar
      </Button>
      <Button size="sm" variant="danger" onClick={() => abrirModalRejeitar(bolsa)}>
        Rejeitar
      </Button>
    </AcoesCell>,
  ])

  return (
    <>
      <PageHeader title="Solicitações de Bolsa" />

      {erro && <Alert tone="error">{erro}</Alert>}

      {carregando ? (
        <p role="status">Carregando solicitações...</p>
      ) : (
        <DataTable
          columns={['Projeto', 'Tipo', 'Edital', 'Valor', 'Status', 'Ações']}
          rows={linhas}
          emptyMessage="Nenhuma bolsa da sua área."
        />
      )}

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
              disabled={enviando || !justificativa.trim()}
            >
              {enviando ? 'Enviando...' : 'Confirmar Rejeição'}
            </Button>
          </FormActions>
        </Modal>
      )}
    </>
  )
}
