import { useEffect, useState } from 'react'
import { bolsasFetch, bolsistasFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  DataTable,
  FormField,
  PageHeader,
  Select,
  useToast,
} from '../components'
import { formatarData, formatarDataHora } from '../utils/dataHora'
import { mensagemDeErro } from '../utils/mensagemDeErro'

function plural(quantidade, singular, pluralizado) {
  return quantidade === 1 ? singular : pluralizado
}

function Bolsa({ bolsa }) {
  return (
    <div className="text-left">
      <p className="font-medium text-gray-900">
        {bolsa.modalidade_display} · {bolsa.carga_horaria_semanal}h
      </p>
      <p className="text-xs text-gray-400">
        {bolsa.projeto_titulo} · {bolsa.edital_ano_codigo}
      </p>
    </div>
  )
}

function Vigencia({ bolsa }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="whitespace-nowrap">
        {bolsa.data_fim_vigencia ? `até ${formatarData(bolsa.data_fim_vigencia)}` : 'Não definida'}
      </span>
      {bolsa.prazo_relatorio_encerrado && (
        <Badge status="REPROVADO" label="Prazo do relatório encerrado" />
      )}
    </div>
  )
}

function Situacao({ bolsa }) {
  if (bolsa.pode_finalizar) {
    return <Badge status="APROVADO" label="Pronta para finalizar" />
  }
  return (
    <ul className="max-w-[340px] list-none text-left text-xs text-gray-500">
      {bolsa.motivos_bloqueio.map((motivo) => (
        <li key={motivo}>{motivo}</li>
      ))}
    </ul>
  )
}

export default function FinalizacaoBolsasPage() {
  const toast = useToast()
  const [bolsas, setBolsas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('finalizadas')
  const [registrando, setRegistrando] = useState(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const response = await bolsistasFetch('/bolsas/')
        const dados = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(dados)) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar as bolsas.'))
        }
        if (ativo) {
          setBolsas(dados)
          setErro('')
        }
      } catch (error) {
        if (ativo) setErro(error.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()
    return () => {
      ativo = false
    }
  }, [versao])

  async function tomarCiencia(bolsa) {
    setRegistrando(bolsa.id)
    try {
      const response = await bolsasFetch(`/${bolsa.id}/ciencia-finalizacao/`, { method: 'POST' })
      const dados = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(mensagemDeErro(dados, 'Não foi possível registrar a ciência.'))
      }
      toast({ message: 'Ciência registrada.', tone: 'success' })
      setVersao((atual) => atual + 1)
    } catch (error) {
      toast({ message: error.message, tone: 'error' })
    } finally {
      setRegistrando(null)
    }
  }

  const finalizadas = bolsas
    .filter((bolsa) => bolsa.status === 'ENCERRADA')
    .sort((a, b) => (b.finalizada_em ?? '').localeCompare(a.finalizada_em ?? ''))
  const andamento = bolsas.filter((bolsa) => bolsa.status !== 'ENCERRADA')
  const semCiencia = finalizadas.filter(
    (bolsa) => bolsa.finalizada_em && !bolsa.ciencia_finalizacao_em
  ).length

  const linhasFinalizadas = finalizadas.map((bolsa) => [
    <Bolsa key="bolsa" bolsa={bolsa} />,
    bolsa.bolsistas_nomes.join(', ') || '—',
    bolsa.finalizada_em ? bolsa.finalizada_por_nome : '—',
    bolsa.finalizada_em ? formatarDataHora(bolsa.finalizada_em) : '—',
    // Encerradas antes da finalização pelo projeto foram encerradas pela própria área.
    !bolsa.finalizada_em ? (
      <span key="ciencia" className="text-xs text-gray-400">
        Encerrada pela coordenação de área
      </span>
    ) : bolsa.ciencia_finalizacao_em ? (
      <span key="ciencia" className="text-xs text-gray-400">
        Ciente em {formatarDataHora(bolsa.ciencia_finalizacao_em)}
      </span>
    ) : (
      <AcoesCell
        key="ciencia"
        ocupado={registrando === bolsa.id}
        acoes={[{ label: 'Tomar ciência', variant: 'accent', onClick: () => tomarCiencia(bolsa) }]}
      />
    ),
  ])

  const linhasAndamento = andamento.map((bolsa) => [
    <Bolsa key="bolsa" bolsa={bolsa} />,
    bolsa.coordenador_projeto_nome,
    <Vigencia key="vigencia" bolsa={bolsa} />,
    <span key="relatorios" className="whitespace-nowrap">
      <strong className="text-gray-900">{bolsa.relatorios_aprovados}</strong> de{' '}
      {bolsa.total_bolsistas} {plural(bolsa.total_bolsistas, 'aprovado', 'aprovados')}
    </span>,
    <Situacao key="situacao" bolsa={bolsa} />,
  ])

  return (
    <>
      <PageHeader title="Finalização de Bolsas" />

      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <FormField label="Bolsas" className="mb-0 min-w-[260px]">
          <Select value={filtro} onChange={(event) => setFiltro(event.target.value)}>
            <option value="finalizadas">
              Finalizadas{semCiencia > 0 ? ` (${semCiencia} aguardando ciência)` : ''}
            </option>
            <option value="andamento">Em andamento ({andamento.length})</option>
          </Select>
        </FormField>
        <p className="max-w-[560px] pb-2.5 text-sm text-gray-500">
          {filtro === 'finalizadas'
            ? 'Os coordenadores de projeto finalizam as bolsas. Tome ciência de cada finalização.'
            : 'Somente leitura: a finalização é feita pelo coordenador do projeto quando não há pendências.'}
        </p>
      </div>

      {filtro === 'finalizadas' ? (
        <DataTable
          columns={['Bolsa', 'Bolsistas', 'Finalizada por', 'Em', 'Ciência']}
          rows={linhasFinalizadas}
          loading={carregando}
          emptyMessage="Nenhuma bolsa da sua área foi finalizada ainda."
        />
      ) : (
        <DataTable
          columns={['Bolsa', 'Coordenador do projeto', 'Vigência', 'Relatórios finais', 'Situação']}
          rows={linhasAndamento}
          loading={carregando}
          emptyMessage="Nenhuma bolsa com bolsistas em andamento na sua área."
        />
      )}
    </>
  )
}
