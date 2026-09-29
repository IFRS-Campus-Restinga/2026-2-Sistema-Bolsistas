import { useEffect, useState } from 'react'
import { Badge, Button, DataTable, Modal, PageHeader, useToast } from '../components'
import { editaisFetch, getCronogramaConsolidado } from '../api'

function formatarData(iso) {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarDataHora(iso) {
  if (!iso) return '—'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(data)
}

function badgePrazo(dataIso) {
  if (!dataIso) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const data = new Date(dataIso + 'T00:00:00')
  const diff = Math.ceil((data - hoje) / (1000 * 60 * 60 * 24))
  if (diff < 0) return <Badge variant="red">Vencido</Badge>
  if (diff <= 7) return <Badge variant="orange">Próximo</Badge>
  return null
}

const COLUNAS_CRONOGRAMA = ['Edital', 'Código', 'Status', 'Etapas', 'Ações']
const COLUNAS_HISTORICO = ['Prazo', 'Data anterior', 'Data atual', 'Alterado por', 'Quando']
const DATAS_CHAVE = [
  ['Abertura', 'data_abertura_inscricoes'],
  ['Fechamento', 'data_fechamento_inscricoes'],
  ['Homologação', 'data_homologacao'],
  ['Início recursos', 'data_recurso_homologacao_inicio'],
  ['Fim recursos', 'data_recurso_homologacao_fim'],
  ['Resultado', 'data_resultado'],
  ['Preenchimento vagas', 'data_maxima_preenchimento_vagas'],
  ['Entrega relatórios', 'data_entrega_relatorios'],
]

export default function CronogramaConsolidadoPage() {
  const toast = useToast()
  const [editais, setEditais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [editalHistorico, setEditalHistorico] = useState(null)
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)

  async function abrirHistorico(edital) {
    setEditalHistorico(edital)
    setCarregandoHistorico(true)

    try {
      const res = await editaisFetch(`/${edital.id}/`)
      const dados = await res.json().catch(() => null)
      if (!res.ok || !dados)
        throw new Error(dados?.detail || 'Erro ao carregar histórico de prazos.')
      setEditalHistorico(dados)
    } catch (error) {
      toast({ message: error.message || 'Erro ao carregar histórico de prazos.', tone: 'error' })
    } finally {
      setCarregandoHistorico(false)
    }
  }

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const res = await getCronogramaConsolidado()
        if (!res.ok) throw new Error('Erro ao carregar cronograma.')
        const dados = await res.json()
        const lista = Array.isArray(dados) ? dados : []

        if (!ativo) return
        setEditais(lista)
      } catch {
        if (ativo) {
          toast({ message: 'Erro ao carregar cronograma consolidado.', tone: 'error' })
        }
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [toast])

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const linhas = editais.map((edital) => [
    edital.nome,
    edital.ano_codigo,
    <Badge key="status" status={edital.status}>
      {edital.status_display}
    </Badge>,
    <div
      key={`etapas-${edital.id}`}
      style={{ lineHeight: 1.8, fontSize: 12, textAlign: 'left', whiteSpace: 'nowrap' }}
    >
      {DATAS_CHAVE.map(([rotulo, campo]) => {
        const data = edital[campo]
        const eProxima = edital.proxima_etapa?.campo === campo
        const passada = data && new Date(data + 'T00:00:00') < hoje && !eProxima
        return (
          <div
            key={campo}
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              fontWeight: eProxima ? 600 : 400,
              color: passada
                ? 'var(--color-text-secondary)'
                : eProxima
                  ? 'var(--color-primary, #2563eb)'
                  : 'inherit',
              opacity: passada ? 0.7 : 1,
            }}
          >
            <span style={{ width: 12, textAlign: 'center' }}>
              {passada ? '✓' : eProxima ? '▶' : '·'}
            </span>
            <span style={{ textDecoration: passada ? 'line-through' : 'none' }}>{rotulo}</span>
            {data && <span style={{ fontSize: 11, opacity: 0.75 }}>({formatarData(data)})</span>}
          </div>
        )
      })}
    </div>,
    <div key={`acoes-${edital.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {edital.proxima_etapa ? badgePrazo(edital.proxima_etapa.data) : null}
      <Button size="sm" variant="outline" onClick={() => abrirHistorico(edital)}>
        Histórico de prazos
      </Button>
    </div>,
  ])

  const linhasHistorico = DATAS_CHAVE.flatMap(([rotulo, campo]) => {
    const alteracoes = editalHistorico?.historico_por_data?.[campo] || []

    if (alteracoes.length === 0) {
      return [
        [
          rotulo,
          '—',
          editalHistorico?.[campo] ? formatarData(editalHistorico[campo]) : '—',
          '—',
          '—',
        ],
      ]
    }

    return alteracoes.map((item, indice) => {
      const ehUltima = indice === alteracoes.length - 1
      return [
        rotulo,
        <span
          key={`${campo}-anterior-${indice}`}
          style={{
            textDecoration: item.data_anterior ? 'line-through' : 'none',
            opacity: item.data_anterior ? 0.65 : 1,
          }}
        >
          {formatarData(item.data_anterior)}
        </span>,
        <span
          key={`${campo}-nova-${indice}`}
          style={{
            textDecoration: item.data_nova && !ehUltima ? 'line-through' : 'none',
            opacity: item.data_nova && !ehUltima ? 0.65 : 1,
            fontWeight: item.data_nova && ehUltima ? 600 : 400,
          }}
        >
          {formatarData(item.data_nova)}
        </span>,
        item.responsavel || '—',
        formatarDataHora(item.alterado_em),
      ]
    })
  })

  return (
    <>
      <PageHeader title="Cronograma Consolidado" />
      <DataTable
        columns={COLUNAS_CRONOGRAMA}
        rows={linhas}
        loading={carregando}
        emptyMessage="Nenhum edital encontrado para a sua área."
      />

      {editalHistorico && (
        <Modal
          title={`Histórico de prazos: ${editalHistorico.ano_codigo}`}
          onClose={() => {
            setEditalHistorico(null)
          }}
          width={900}
        >
          <DataTable
            columns={COLUNAS_HISTORICO}
            rows={linhasHistorico}
            loading={carregandoHistorico}
            emptyMessage="Sem dados de cronograma para este edital."
          />
        </Modal>
      )}
    </>
  )
}
