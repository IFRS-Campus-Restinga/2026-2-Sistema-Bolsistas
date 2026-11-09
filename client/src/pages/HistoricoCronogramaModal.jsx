import { useEffect, useState } from 'react'
import { editaisFetch } from '../api'
import { Alert, DataTable, Modal } from '../components'
import { formatarData, formatarDataHora } from '../utils/dataHora'
import { mensagemDeErro } from '../utils/mensagemDeErro'

/**
 * Histórico de alterações de prazos do cronograma (Admin e Coord. de Área).
 *
 * Com `edital`, mostra só as alterações dele; sem, todas as alterações de todos os editais.
 */
export default function HistoricoCronogramaModal({ edital = null, onFechar }) {
  const [alteracoes, setAlteracoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const filtro = edital ? `?edital=${edital.id}` : ''
        const response = await editaisFetch(`/historico-cronograma/${filtro}`)
        const dados = await response.json().catch(() => null)

        if (!response.ok || !Array.isArray(dados)) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar o histórico.'))
        }

        if (ativo) setAlteracoes(dados)
      } catch (error) {
        if (ativo) setErro(error.message || 'Falha ao conectar ao servidor.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()
    return () => {
      ativo = false
    }
  }, [edital])

  const colunas = [
    ...(edital ? [] : ['Edital']),
    'Etapa',
    'Data anterior',
    'Nova data',
    'Alterado por',
    'Quando',
  ]

  const linhas = alteracoes.map((alteracao) => [
    ...(edital ? [] : [`${alteracao.edital_nome} (${alteracao.edital_ano_codigo})`]),
    alteracao.etapa,
    formatarData(alteracao.data_anterior) || '—',
    formatarData(alteracao.data_nova) || '—',
    <span key="responsavel" title={alteracao.responsavel_email || undefined}>
      {alteracao.responsavel_nome}
    </span>,
    formatarDataHora(alteracao.alterado_em),
  ])

  return (
    <Modal
      title={
        edital
          ? `Histórico de prazos — ${edital.nome} (${edital.ano_codigo})`
          : 'Histórico de prazos dos editais'
      }
      onClose={onFechar}
      width={edital ? 760 : 920}
    >
      {erro && <Alert tone="error">{erro}</Alert>}

      <DataTable
        columns={colunas}
        rows={linhas}
        loading={carregando}
        emptyMessage={
          erro ? 'Histórico indisponível.' : 'Nenhuma alteração de prazo registrada até agora.'
        }
      />
    </Modal>
  )
}
