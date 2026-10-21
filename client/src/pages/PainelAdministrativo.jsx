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
import './PainelAdministrativo.css'

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
    <div className="painel-barra" title={descricao}>
      <div className="painel-barra__trilho" style={{ width: `${larguraTrilho}%` }}>
        {valor > 0 && <div className="painel-barra__valor" style={{ width: `${larguraValor}%` }} />}
      </div>
    </div>
  )
}

function Cartao({ titulo, acao, children }) {
  return (
    <section className="painel-cartao">
      <header className="painel-cartao__cabecalho">
        <h3 className="painel-cartao__titulo">{titulo}</h3>
        {acao}
      </header>
      {children}
    </section>
  )
}

function FunilSelecao({ funil }) {
  const enviadas = funil.enviadas

  if (enviadas === 0) {
    return <p className="painel-vazio">Nenhuma inscrição enviada ainda.</p>
  }

  return (
    <ul className="painel-linhas">
      {ETAPAS_DO_FUNIL.map(({ chave, rotulo }, indice) => {
        const valor = funil[chave]
        const contexto = indice === 0 ? '' : `de ${enviadas}`
        return (
          <li key={chave} className="painel-linha">
            <span className="painel-linha__rotulo">{rotulo}</span>
            <Barra
              valor={valor}
              total={enviadas}
              escala={enviadas}
              descricao={`${rotulo}: ${valor} ${contexto}`.trim()}
            />
            <span className="painel-linha__numero">
              <strong>{valor}</strong> {contexto}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function VagasPorTipo({ vagas }) {
  if (vagas.total === 0) {
    return <p className="painel-vazio">Nenhuma bolsa ofertada ainda.</p>
  }

  const maiorTotal = Math.max(...vagas.por_tipo.map((item) => item.total))

  return (
    <ul className="painel-linhas">
      {vagas.por_tipo.map((item) => (
        <li key={item.tipo} className="painel-linha">
          <span className="painel-linha__rotulo">{item.rotulo}</span>
          {item.total > 0 ? (
            <>
              <Barra
                valor={item.ocupadas}
                total={item.total}
                escala={maiorTotal}
                descricao={`${item.rotulo}: ${item.ocupadas} de ${item.total} vagas ocupadas`}
              />
              <span className="painel-linha__numero">
                <strong>{item.ocupadas}</strong> de {item.total}
              </span>
            </>
          ) : (
            <span className="painel-linha__sem-dado">Nenhuma vaga ofertada</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function Pendencias({ pendencias }) {
  return (
    <ul className="painel-pendencias">
      {PENDENCIAS.map(({ chave, rotulo }) => {
        const quantidade = pendencias[chave]
        const pendente = quantidade > 0
        return (
          <li
            key={chave}
            className={`painel-pendencia${pendente ? ' painel-pendencia--ativa' : ''}`}
          >
            <span className="painel-pendencia__icone" aria-hidden="true">
              {pendente ? <IconAlertTriangle /> : <IconCheck />}
            </span>
            <span className="painel-pendencia__rotulo">{rotulo}</span>
            <span className="painel-pendencia__numero">{pendente ? quantidade : 'Nenhum'}</span>
          </li>
        )
      })}
    </ul>
  )
}

function AtividadeRecente({ atividades }) {
  if (atividades.length === 0) {
    return <p className="painel-vazio">Nenhuma atividade registrada ainda.</p>
  }

  return (
    <ul className="painel-atividades">
      {atividades.map((log) => (
        <li key={log.id} className="painel-atividade">
          <Badge status={log.acao} label={log.acao_display} />
          <div className="painel-atividade__texto">
            <p className="painel-atividade__descricao">{log.descricao}</p>
            <p className="painel-atividade__meta">
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
    <div className={`painel${carregando ? ' painel--atualizando' : ''}`}>
      <div className="painel-filtro">
        <FormField label="Edital">
          <Select value={edital} onChange={(event) => setEdital(event.target.value)}>
            <option value="">Todos os editais</option>
            {dados.editais.map((item) => (
              <option key={item.id} value={item.id}>
                {item.ano_codigo} · {item.nome} ({item.status_display})
              </option>
            ))}
          </Select>
        </FormField>
        <span className="painel-filtro__contexto">
          {dados.editais_em_vigor}{' '}
          {plural(dados.editais_em_vigor, 'edital em vigor', 'editais em vigor')} de{' '}
          {dados.editais.length} {plural(dados.editais.length, 'publicado', 'publicados')}
        </span>
      </div>

      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="painel-indicadores">
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

      <div className="painel-grade">
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
              className="painel-cartao__link"
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
