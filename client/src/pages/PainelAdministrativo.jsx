import { useEffect, useState } from 'react'
import { monitoramentoFetch } from '../api'
import {
  Alert,
  Badge,
  Carregando,
  FormField,
  IconAlertTriangle,
  IconBriefcase,
  IconCheck,
  IconClipboardList,
  IconUsers,
  Select,
  StatCard,
} from '../components'

const VAZIO = 'py-6 text-center text-base text-gray-400'
const LINHAS = 'flex list-none flex-col gap-3.5'
const LINHA = 'grid grid-cols-[minmax(110px,30%)_minmax(0,1fr)_72px] items-center gap-3 text-sm'
const NUMERO = 'text-right whitespace-nowrap text-gray-500 tabular-nums'
const NUMERO_DESTAQUE = 'text-base text-gray-900'

const ETAPAS_DO_FUNIL = [
  { chave: 'enviadas', rotulo: 'Enviadas' },
  { chave: 'homologadas', rotulo: 'Homologadas' },
  { chave: 'classificadas', rotulo: 'Classificadas' },
  { chave: 'vinculadas', rotulo: 'Indicadas como bolsistas' },
]

const PENDENCIAS = [
  { chave: 'bolsas_aguardando_aprovacao', rotulo: 'Bolsas aguardando aprovação' },
  { chave: 'recursos_sem_julgamento', rotulo: 'Recursos sem julgamento' },
  { chave: 'convites_aguardando_analise', rotulo: 'Convites de vínculo direto aguardando análise' },
]

function plural(quantidade, singular, pluralizado) {
  return quantidade === 1 ? singular : pluralizado
}

// Barra horizontal: o trilho mostra o total e o preenchimento a parte; ambos na mesma escala.
function Barra({ valor, total, escala, descricao }) {
  const larguraTrilho = escala > 0 ? (total / escala) * 100 : 0
  const larguraValor = total > 0 ? (valor / total) * 100 : 0

  return (
    <div className="py-1" title={descricao}>
      <div
        className="h-3 overflow-hidden rounded bg-gray-100"
        style={{ width: `${larguraTrilho}%` }}
      >
        {valor > 0 && (
          <div
            className="h-full min-w-1 rounded bg-if-green"
            style={{ width: `${larguraValor}%` }}
          />
        )}
      </div>
    </div>
  )
}

function Cartao({ titulo, acao, children }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-bold text-gray-900">{titulo}</h3>
        {acao}
      </header>
      {children}
    </section>
  )
}

function FunilSelecao({ funil }) {
  const enviadas = funil.enviadas

  if (enviadas === 0) {
    return <p className={VAZIO}>Nenhuma inscrição enviada ainda.</p>
  }

  return (
    <ul className={LINHAS}>
      {ETAPAS_DO_FUNIL.map(({ chave, rotulo }, indice) => {
        const valor = funil[chave]
        const contexto = indice === 0 ? '' : `de ${enviadas}`
        return (
          <li key={chave} className={LINHA}>
            <span className="text-gray-700">{rotulo}</span>
            <Barra
              valor={valor}
              total={enviadas}
              escala={enviadas}
              descricao={`${rotulo}: ${valor} ${contexto}`.trim()}
            />
            <span className={NUMERO}>
              <strong className={NUMERO_DESTAQUE}>{valor}</strong> {contexto}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function VagasPorTipo({ vagas }) {
  if (vagas.total === 0) {
    return <p className={VAZIO}>Nenhuma bolsa ofertada ainda.</p>
  }

  const maiorTotal = Math.max(...vagas.por_tipo.map((item) => item.total))

  return (
    <ul className={LINHAS}>
      {vagas.por_tipo.map((item) => (
        <li key={item.tipo} className={LINHA}>
          <span className="text-gray-700">{item.rotulo}</span>
          {item.total > 0 ? (
            <>
              <Barra
                valor={item.ocupadas}
                total={item.total}
                escala={maiorTotal}
                descricao={`${item.rotulo}: ${item.ocupadas} de ${item.total} vagas ocupadas`}
              />
              <span className={NUMERO}>
                <strong className={NUMERO_DESTAQUE}>{item.ocupadas}</strong> de {item.total}
              </span>
            </>
          ) : (
            <span className="col-[2/-1] text-gray-400">Nenhuma vaga ofertada</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function Pendencias({ pendencias }) {
  return (
    <ul className="flex list-none flex-col gap-2">
      {PENDENCIAS.map(({ chave, rotulo }) => {
        const quantidade = pendencias[chave]
        const pendente = quantidade > 0
        return (
          <li
            key={chave}
            className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm ${pendente ? 'bg-orange-50 text-gray-700' : 'bg-gray-50 text-gray-500'}`}
          >
            <span
              className={`flex ${pendente ? 'text-orange-600' : 'text-green-600'}`}
              aria-hidden="true"
            >
              {pendente ? <IconAlertTriangle size={18} /> : <IconCheck size={18} />}
            </span>
            <span className="flex-1">{rotulo}</span>
            <span
              className={`tabular-nums ${pendente ? 'font-bold text-gray-900' : 'font-medium text-gray-400'}`}
            >
              {pendente ? quantidade : 'Nenhum'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function AtividadeRecente({ atividades }) {
  if (atividades.length === 0) {
    return <p className={VAZIO}>Nenhuma atividade registrada ainda.</p>
  }

  return (
    <ul className="flex list-none flex-col">
      {atividades.map((log) => (
        <li
          key={log.id}
          className="flex items-start gap-3 border-b border-gray-100 py-2.5 last:border-b-0"
        >
          <Badge status={log.acao} label={log.acao_display} />
          <div className="min-w-0">
            <p className="text-sm wrap-anywhere text-gray-900">{log.descricao}</p>
            <p className="mt-0.5 text-xs text-gray-400">
              {log.usuario_nome || 'Sistema'} · {new Date(log.data_hora).toLocaleString('pt-BR')}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function PainelAdministrativo({ onNavigate }) {
  const [edital, setEdital] = useState('')
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        const consulta = edital ? `?${new URLSearchParams({ edital })}` : ''
        const response = await monitoramentoFetch(`/painel/${consulta}`)
        const resultado = await response.json().catch(() => null)

        if (!response.ok || !resultado?.funil) {
          throw new Error(resultado?.detail || 'Não foi possível carregar o painel.')
        }
        if (ativo) setDados(resultado)
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
  }, [edital])

  if (!dados) {
    return erro ? <Alert tone="error">{erro}</Alert> : <Carregando texto="Carregando painel..." />
  }

  const { bolsas, vagas, funil, pendencias } = dados
  const totalPendencias = Object.values(pendencias).reduce((soma, valor) => soma + valor, 0)

  return (
    <div
      className={`flex flex-col gap-5 transition-opacity duration-200 ease-[ease] ${carregando ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <FormField label="Edital" className="mb-0 min-w-[min(100%,360px)]">
          <Select value={edital} onChange={(event) => setEdital(event.target.value)}>
            <option value="">Todos os editais</option>
            {dados.editais.map((item) => (
              <option key={item.id} value={item.id}>
                {item.ano_codigo} · {item.nome} ({item.status_display})
              </option>
            ))}
          </Select>
        </FormField>
        <span className="pb-2.5 text-sm text-gray-500">
          {dados.editais_em_vigor}{' '}
          {plural(dados.editais_em_vigor, 'edital em vigor', 'editais em vigor')} de{' '}
          {dados.editais.length} {plural(dados.editais.length, 'publicado', 'publicados')}
        </span>
      </div>

      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        <StatCard
          label="Bolsas ofertadas"
          value={bolsas.ofertadas}
          detail={`em ${bolsas.projetos} ${plural(bolsas.projetos, 'projeto', 'projetos')}`}
          icon={<IconBriefcase />}
          color="green"
        />
        <StatCard
          label="Vagas ocupadas"
          value={vagas.ocupadas}
          detail={`de ${vagas.total} ${plural(vagas.total, 'vaga', 'vagas')}`}
          icon={<IconUsers />}
          color="blue"
        />
        <StatCard
          label="Inscrições enviadas"
          value={funil.enviadas}
          detail={`${funil.homologadas} ${plural(funil.homologadas, 'homologada', 'homologadas')}`}
          icon={<IconClipboardList />}
          color="purple"
        />
        <StatCard
          label="Pendências"
          value={totalPendencias}
          detail={totalPendencias === 0 ? 'nada aguardando' : 'aguardando ação'}
          icon={totalPendencias === 0 ? <IconCheck /> : <IconAlertTriangle />}
          color={totalPendencias === 0 ? 'green' : 'orange'}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        <Cartao titulo="Status da seleção">
          <FunilSelecao funil={funil} />
        </Cartao>

        <Cartao titulo="Vagas ocupadas por tipo de bolsa">
          <VagasPorTipo vagas={vagas} />
        </Cartao>

        <Cartao titulo="Precisa de atenção">
          <Pendencias pendencias={pendencias} />
        </Cartao>

        <Cartao
          titulo="Atividade recente"
          acao={
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-sm leading-[normal] font-semibold text-if-green hover:underline"
              onClick={() => onNavigate?.('auditoria')}
            >
              Ver auditoria →
            </button>
          }
        >
          <AtividadeRecente atividades={dados.atividade_recente} />
        </Cartao>
      </div>
    </div>
  )
}
