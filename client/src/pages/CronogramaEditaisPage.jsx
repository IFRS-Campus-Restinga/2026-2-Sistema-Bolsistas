import { useEffect, useState } from 'react'
import { editaisFetch } from '../api'
import {
  Alert,
  Button,
  Card,
  Carregando,
  Cronograma,
  EmptyState,
  IconCalendar,
  IconHistory,
  PageHeader,
  Prazo,
  StatusPill,
  Tabs,
  Tag,
} from '../components'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import HistoricoCronogramaDrawer from './HistoricoCronogramaDrawer'

// Arquivado entra junto com Encerrado, como na tela de editais.
const ABAS = {
  todos: () => true,
  EM_VIGOR: (edital) => edital.status === 'EM_VIGOR',
  RASCUNHO: (edital) => edital.status === 'RASCUNHO',
  ENCERRADO: (edital) => ['ENCERRADO', 'ARQUIVADO'].includes(edital.status),
}

function EditalCronogramaCard({ edital, podeVerHistorico, onDetalhes }) {
  const { proxima_etapa: proxima, total_alteracoes: alteracoes } = edital

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="truncate text-[15px] font-semibold text-gray-900">{edital.nome}</h3>
            <StatusPill status={edital.status} size="sm" />
          </div>
          <span className="font-mono text-xs text-gray-500">{edital.ano_codigo}</span>
        </div>
        {proxima && <Prazo dias={proxima.dias} prefixo={proxima.etapa} />}
      </div>

      <div className="px-5 pt-4 pb-4">
        <Cronograma fases={edital.fases.fases} atual={edital.fases.atual} />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
          <Tag>
            {edital.total_bolsas} {edital.total_bolsas === 1 ? 'bolsa' : 'bolsas'}
          </Tag>
          {podeVerHistorico && alteracoes > 0 && (
            <Tag icon={<IconHistory />}>
              {alteracoes} {alteracoes === 1 ? 'prazo alterado' : 'prazos alterados'}
            </Tag>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onDetalhes}>
          Detalhes
        </Button>
      </div>
    </Card>
  )
}

/**
 * Cronograma consolidado: todos os editais do perfil com as datas-chave (US19).
 *
 * Props:
 *   podeVerHistorico — Admin e Coord. de Área consultam o histórico de prazos (US20)
 *   filtrarStatus    — mostra as abas de status (o Coord. de Projeto só vê editais em vigor)
 */
export default function CronogramaEditaisPage({ podeVerHistorico = false, filtrarStatus = true }) {
  const [editais, setEditais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('todos')
  // undefined: fechado; null: histórico de todos os editais; objeto: detalhes do edital
  const [detalhe, setDetalhe] = useState(undefined)

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

  const visiveis = editais.filter(ABAS[aba])
  const contar = (filtro) => editais.filter(filtro).length

  return (
    <>
      <PageHeader
        title="Cronograma"
        description="Datas-chave de todos os editais, da inscrição ao fim da vigência."
        action={
          podeVerHistorico && (
            <Button size="sm" onClick={() => setDetalhe(null)}>
              <IconHistory /> Histórico de prazos
            </Button>
          )
        }
      />

      {erro && <Alert tone="error">{erro}</Alert>}

      {filtrarStatus && (
        <Tabs
          value={aba}
          onChange={setAba}
          tabs={[
            { id: 'todos', label: 'Todos' },
            { id: 'EM_VIGOR', label: 'Em vigor', count: contar(ABAS.EM_VIGOR) },
            { id: 'RASCUNHO', label: 'Rascunhos', count: contar(ABAS.RASCUNHO) },
            { id: 'ENCERRADO', label: 'Encerrados' },
          ]}
        />
      )}

      {carregando ? (
        <Carregando texto="Carregando cronograma..." />
      ) : visiveis.length === 0 ? (
        !erro && (
          <EmptyState
            icon={<IconCalendar />}
            title="Nenhum edital encontrado"
            description={
              editais.length
                ? 'Não há editais nesta aba.'
                : 'Os editais aparecem aqui assim que forem cadastrados.'
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visiveis.map((edital) => (
            <EditalCronogramaCard
              key={edital.id}
              edital={edital}
              podeVerHistorico={podeVerHistorico}
              onDetalhes={() => setDetalhe(edital)}
            />
          ))}
        </div>
      )}

      {detalhe !== undefined && (
        <HistoricoCronogramaDrawer
          edital={detalhe}
          podeVerHistorico={podeVerHistorico}
          onFechar={() => setDetalhe(undefined)}
        />
      )}
    </>
  )
}
