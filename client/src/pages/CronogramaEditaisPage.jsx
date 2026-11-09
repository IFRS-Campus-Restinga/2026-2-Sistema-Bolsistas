import { useEffect, useState } from 'react'
import { editaisFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  Button,
  DataTable,
  FormField,
  PageHeader,
  Select,
} from '../components'
import { formatarData } from '../utils/dataHora'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import HistoricoCronogramaModal from './HistoricoCronogramaModal'

const STATUS_OPCOES = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'EM_VIGOR', rotulo: 'Em vigor' },
  { valor: 'RASCUNHO', rotulo: 'Rascunho' },
  { valor: 'ENCERRADO', rotulo: 'Encerrado' },
  { valor: 'ARQUIVADO', rotulo: 'Arquivado' },
]

function dataDaEtapa(edital, campo) {
  return edital.etapas.find((etapa) => etapa.campo === campo)?.data
}

function periodo(edital, campoInicio, campoFim) {
  const inicio = formatarData(dataDaEtapa(edital, campoInicio))
  const fim = formatarData(dataDaEtapa(edital, campoFim))
  if (!inicio && !fim) return '—'
  return `${inicio || '?'} a ${fim || '?'}`
}

function data(edital, campo) {
  return formatarData(dataDaEtapa(edital, campo)) || '—'
}

/**
 * Cronograma consolidado: todos os editais do perfil com as datas-chave (US19).
 *
 * Props:
 *   podeVerHistorico — Admin e Coord. de Área consultam o histórico de prazos (US20)
 *   filtrarStatus    — mostra o filtro de status (o Coord. de Projeto só vê editais em vigor)
 */
export default function CronogramaEditaisPage({ podeVerHistorico = false, filtrarStatus = true }) {
  const [editais, setEditais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [status, setStatus] = useState('')
  // undefined: fechado; null: histórico de todos os editais; objeto: histórico do edital
  const [historico, setHistorico] = useState(undefined)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const response = await editaisFetch('/cronograma/')
        const dados = await response.json().catch(() => null)

        if (!response.ok || !Array.isArray(dados)) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar o cronograma.'))
        }

        if (ativo) setEditais(dados)
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
  }, [])

  const visiveis = status ? editais.filter((edital) => edital.status === status) : editais

  const linhas = visiveis.map((edital) => [
    <div key="edital" className="flex flex-col">
      <span className="font-semibold text-gray-800">{edital.nome}</span>
      <span className="text-xs text-gray-400">{edital.ano_codigo}</span>
    </div>,
    <Badge key="status" status={edital.status} />,
    periodo(edital, 'data_abertura_inscricoes', 'data_fechamento_inscricoes'),
    data(edital, 'data_homologacao'),
    periodo(edital, 'data_recurso_homologacao_inicio', 'data_recurso_homologacao_fim'),
    data(edital, 'data_resultado'),
    data(edital, 'data_entrega_relatorios'),
    edital.proxima_etapa ? (
      <div key="proxima" className="flex flex-col">
        <span className="font-medium text-gray-800">{edital.proxima_etapa.etapa}</span>
        <span className="text-xs text-gray-400">{formatarData(edital.proxima_etapa.data)}</span>
      </div>
    ) : (
      '—'
    ),
    edital.total_bolsas,
    ...(podeVerHistorico
      ? [
          <AcoesCell
            key="historico"
            mostrar={edital.total_alteracoes > 0}
            acoes={[
              {
                label: `Histórico (${edital.total_alteracoes})`,
                onClick: () => setHistorico(edital),
              },
            ]}
          />,
        ]
      : []),
  ])

  return (
    <>
      <PageHeader
        title="Cronograma dos Editais"
        action={
          podeVerHistorico && (
            <Button variant="outline" size="sm" onClick={() => setHistorico(null)}>
              Histórico de prazos
            </Button>
          )
        }
      />

      {filtrarStatus && (
        <div className="mb-4 max-w-60">
          <FormField label="Status" className="mb-0">
            <Select value={status} onChange={(evento) => setStatus(evento.target.value)}>
              {STATUS_OPCOES.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      )}

      {erro && <Alert tone="error">{erro}</Alert>}

      <DataTable
        columns={[
          'Edital',
          'Status',
          'Inscrições',
          'Homologação',
          'Recursos',
          'Resultado',
          'Relatórios',
          'Próxima etapa',
          'Bolsas',
          ...(podeVerHistorico ? ['Alterações'] : []),
        ]}
        rows={linhas}
        loading={carregando}
        emptyMessage={
          erro ? 'Cronograma indisponível.' : 'Nenhum edital encontrado para este filtro.'
        }
      />

      {historico !== undefined && (
        <HistoricoCronogramaModal edital={historico} onFechar={() => setHistorico(undefined)} />
      )}
    </>
  )
}
