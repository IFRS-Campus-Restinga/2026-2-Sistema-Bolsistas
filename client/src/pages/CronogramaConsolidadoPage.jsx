import { useEffect, useState } from 'react'
import { Badge, Button, DataTable, IconArrowLeft, Modal, PageHeader } from '../components'
import { getCronogramaConsolidado, getHistoricoCronograma } from '../api'
import { useToast } from '../components'

function formatarData(iso) {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
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

const COLUNAS_HISTORICO = ['Prazo', 'Data anterior', 'Nova data', 'Alterado por', 'Quando']
const COLUNAS_CRONOGRAMA = ['Edital', 'Código', 'Status', 'Etapas', 'Datas', 'Ações']
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
  const { showToast } = useToast()
  const [editais, setEditais] = useState([])
  const [historicoPorEdital, setHistoricoPorEdital] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [editalHistorico, setEditalHistorico] = useState(null)
  const [historico, setHistorico] = useState([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)

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

        const respostas = await Promise.all(
          lista.map(async (edital) => {
            try {
              const historicoRes = await getHistoricoCronograma(edital.id)
              const historicoDados = await historicoRes.json().catch(() => null)
              if (!historicoRes.ok || !Array.isArray(historicoDados)) {
                return [edital.id, []]
              }
              return [edital.id, historicoDados]
            } catch {
              return [edital.id, []]
            }
          })
        )

        if (!ativo) return
        setHistoricoPorEdital(Object.fromEntries(respostas))
      } catch {
        if (ativo) showToast('Erro ao carregar cronograma consolidado.', 'error')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  function datasPorCampo(edital, campo) {
    const historicoEdital = historicoPorEdital[edital.id] || []
    const alteracoesCampo = historicoEdital.filter((item) => item.campo === campo)

    if (alteracoesCampo.length === 0) {
      return edital[campo] ? [edital[campo]] : ['—']
    }

    const sequencia = []
    const primeiraDataAnterior = alteracoesCampo[0]?.data_anterior
    if (primeiraDataAnterior) sequencia.push(primeiraDataAnterior)
    alteracoesCampo.forEach((alteracao) => {
      if (alteracao.data_nova) sequencia.push(alteracao.data_nova)
    })

    if (edital[campo] && sequencia[sequencia.length - 1] !== edital[campo]) {
      sequencia.push(edital[campo])
    }

    return sequencia.length > 0 ? sequencia : ['—']
  }

  async function abrirHistorico(edital) {
    setEditalHistorico(edital)
    setHistorico([])
    setCarregandoHistorico(true)

    try {
      const res = await getHistoricoCronograma(edital.id)
      const dados = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(dados?.detail || 'Erro ao carregar histórico de prazos.')
      }
      setHistorico(Array.isArray(dados) ? dados : [])
    } catch (error) {
      showToast(error.message || 'Erro ao carregar histórico de prazos.', 'error')
    } finally {
      setCarregandoHistorico(false)
    }
  }

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
    <div
      key={`datas-${edital.id}`}
      style={{
        display: 'grid',
        rowGap: 4,
        minWidth: 360,
        textAlign: 'left',
        margin: '0 auto',
      }}
    >
      {DATAS_CHAVE.map(([rotulo, campo]) => (
        <div
          key={`${edital.id}-${campo}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '170px 1fr',
            alignItems: 'center',
            columnGap: 8,
          }}
        >
          <strong>{rotulo}:</strong>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {datasPorCampo(edital, campo).map((data, index, lista) => {
              const antiga = index < lista.length - 1
              return (
                <span key={`${edital.id}-${campo}-${index}-${data}`}>
                  <span
                    style={{
                      textDecoration: antiga ? 'line-through' : 'none',
                      opacity: antiga ? 0.65 : 1,
                    }}
                  >
                    {data === '—' ? '—' : formatarData(data)}
                  </span>
                  {index < lista.length - 1 && (
                    <span
                      aria-hidden="true"
                      style={{
                        margin: '0 2px',
                        opacity: 0.65,
                        display: 'inline-flex',
                        alignItems: 'center',
                        transform: 'scaleX(-1)',
                      }}
                    >
                      <IconArrowLeft size={12} />
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      ))}
    </div>,
    <div key={`acoes-${edital.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {edital.proxima_etapa ? badgePrazo(edital.proxima_etapa.data) : null}
      <Button size="sm" variant="outline" onClick={() => abrirHistorico(edital)}>
        Histórico
      </Button>
    </div>,
  ])

  const ultimoIndicePorCampo = historico.reduce((acumulado, item, indice) => {
    acumulado[item.campo] = indice
    return acumulado
  }, {})

  const linhasHistorico = historico.map((item, indice) => {
    const ehUltimaAlteracaoDoCampo = ultimoIndicePorCampo[item.campo] === indice
    return [
      item.campo_display || item.campo || '—',
      <span
        key={`anterior-${item.id}`}
        style={{
          textDecoration: item.data_anterior ? 'line-through' : 'none',
          opacity: item.data_anterior ? 0.65 : 1,
        }}
      >
        {formatarData(item.data_anterior)}
      </span>,
      <span
        key={`nova-${item.id}`}
        style={{
          textDecoration: item.data_nova && !ehUltimaAlteracaoDoCampo ? 'line-through' : 'none',
          opacity: item.data_nova && !ehUltimaAlteracaoDoCampo ? 0.65 : 1,
          fontWeight: item.data_nova && ehUltimaAlteracaoDoCampo ? 600 : 400,
        }}
      >
        {formatarData(item.data_nova)}
      </span>,
      item.responsavel || '—',
      item.alterado_em || '—',
    ]
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
          onClose={() => setEditalHistorico(null)}
          width={900}
        >
          <DataTable
            columns={COLUNAS_HISTORICO}
            rows={linhasHistorico}
            loading={carregandoHistorico}
            emptyMessage="Nenhuma alteração de prazo registrada para este edital."
          />
        </Modal>
      )}
    </>
  )
}
