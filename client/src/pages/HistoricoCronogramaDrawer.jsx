import { useEffect, useState } from 'react'
import { editaisFetch } from '../api'
import {
  Alert,
  Carregando,
  Cronograma,
  Drawer,
  KeyValue,
  StatusPill,
  Timeline,
} from '../components'
import { formatarData, formatarDataHora } from '../utils/dataHora'
import { mensagemDeErro } from '../utils/mensagemDeErro'

function paraTimeline(alteracoes, mostrarEdital) {
  return alteracoes.map((alteracao) => {
    const anterior = formatarData(alteracao.data_anterior) || 'sem data'
    const nova = formatarData(alteracao.data_nova) || 'sem data'
    const edital = mostrarEdital ? `${alteracao.edital_nome} · ` : ''
    return {
      id: alteracao.id,
      tone: 'info',
      title: `${edital}${alteracao.etapa}: ${anterior} → ${nova}`,
      meta: `${alteracao.responsavel_nome} · ${formatarDataHora(alteracao.alterado_em)}`,
    }
  })
}

/**
 * Detalhes do cronograma num painel lateral (US19/US20).
 *
 * Com `edital`, mostra todas as datas dele e, para Admin e Coord. de Área, o histórico de
 * prazos do edital. Sem `edital`, mostra o histórico de prazos de todos os editais.
 */
export default function HistoricoCronogramaDrawer({
  edital = null,
  podeVerHistorico = false,
  onFechar,
}) {
  const [alteracoes, setAlteracoes] = useState([])
  const [carregando, setCarregando] = useState(podeVerHistorico)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!podeVerHistorico) return undefined
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
  }, [edital, podeVerHistorico])

  const historico = podeVerHistorico && (
    <section>
      <p className="mb-3 text-xs font-medium text-gray-500">Histórico de prazos</p>
      {erro && <Alert tone="error">{erro}</Alert>}
      {carregando ? (
        <Carregando texto="Carregando histórico..." />
      ) : (
        !erro && (
          <Timeline
            items={paraTimeline(alteracoes, !edital)}
            vazio="Nenhuma alteração de prazo registrada até agora."
          />
        )
      )}
    </section>
  )

  if (!edital) {
    return (
      <Drawer
        title="Histórico de prazos"
        subtitle="Alterações de datas em todos os editais"
        width={600}
        onClose={onFechar}
      >
        <div className="p-5">{historico}</div>
      </Drawer>
    )
  }

  return (
    <Drawer
      title={edital.nome}
      subtitle={
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs">{edital.ano_codigo}</span>
          <StatusPill status={edital.status} size="sm" />
        </span>
      }
      width={600}
      onClose={onFechar}
    >
      <div className="flex flex-col gap-6 p-5">
        <section>
          <p className="mb-3 text-xs font-medium text-gray-500">Andamento</p>
          <Cronograma fases={edital.fases.fases} atual={edital.fases.atual} />
        </section>

        <section>
          <p className="mb-3 text-xs font-medium text-gray-500">Datas-chave</p>
          <dl className="grid grid-cols-2 gap-4">
            {edital.etapas.map((etapa) => (
              <KeyValue key={etapa.campo} label={etapa.etapa}>
                <span className="tabular-nums">{formatarData(etapa.data) || '—'}</span>
              </KeyValue>
            ))}
          </dl>
        </section>

        {historico}
      </div>
    </Drawer>
  )
}
