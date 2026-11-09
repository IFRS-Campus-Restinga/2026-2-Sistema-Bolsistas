import { useEffect, useState } from 'react'
import { monitoramentoFetch } from '../api'
import {
  Alert,
  AttentionList,
  Avatar,
  Button,
  Card,
  Carregando,
  IconBolsa,
  IconClipboardCheck,
  IconFolder,
  IconUsers,
  PageHeader,
  SectionTitle,
  StatCard,
} from '../components'
import { iniciais } from '../utils/iniciais'
import { formatarMesCurto } from '../utils/mesReferencia'

const MESES_ABREVIADOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

/** Rótulo das frequências do mês anterior: "Frequências de out/2026 a lançar (até dia 10)". */
function rotuloFrequencias({ mes_referencia: mes, prazo }) {
  const ate = prazo ? ` (até dia ${Number(prazo.split('-')[2])})` : ''
  return `Frequências de ${formatarMesCurto(mes).toLowerCase()} a lançar${ate}`
}

function EtapaDaAgenda({ etapa }) {
  const quando = new Date(etapa.data_hora)
  const hora = quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const detalhes = [
    `${etapa.bolsa_modalidade} · ${etapa.bolsa_carga_horaria}h`,
    hora,
    etapa.local,
  ].filter(Boolean)

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex size-10 flex-col items-center justify-center rounded-lg border border-gray-200 text-center leading-none">
        <span className="text-sm font-semibold text-gray-900">
          {String(quando.getDate()).padStart(2, '0')}
        </span>
        <span className="text-[10px] text-gray-500 uppercase">
          {MESES_ABREVIADOS[quando.getMonth()]}
        </span>
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-gray-900">{etapa.nome}</span>
        <span className="text-xs text-gray-500">{detalhes.join(' · ')}</span>
      </span>
    </li>
  )
}

/** Início do coordenador de projeto: resumo dos projetos e do que precisa de atenção (US92). */
export default function InicioProjetoPage({ nome, onNav }) {
  const [painel, setPainel] = useState(null)
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const res = await monitoramentoFetch('/painel/projeto/')
        if (!res.ok) throw new Error('Não foi possível carregar o painel.')
        const dados = await res.json()
        if (ativo) setPainel(dados)
      } catch (e) {
        if (ativo) setErro(e.message)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [tentativa])

  const primeiroNome = (nome || '').replace('[dev]', '').trim().split(' ')[0]
  const cabecalho = (
    <PageHeader
      title={primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'}
      description="Resumo dos seus projetos e do que precisa da sua atenção."
    />
  )

  if (erro) {
    return (
      <>
        {cabecalho}
        <Alert tone="error">{erro}</Alert>
        <Button
          onClick={() => {
            setErro('')
            setTentativa((n) => n + 1)
          }}
        >
          Tentar novamente
        </Button>
      </>
    )
  }
  if (!painel) {
    return (
      <>
        {cabecalho}
        <Carregando texto="Carregando painel..." />
      </>
    )
  }

  const { atencao, frequencias_a_lancar: frequencias } = painel
  const semFrequencia = frequencias.bolsistas

  return (
    <>
      {cabecalho}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Projetos"
          value={painel.projetos}
          icon={<IconFolder />}
          color="gray"
          onClick={() => onNav('projetos')}
        />
        <StatCard
          label="Bolsas abertas"
          value={painel.bolsas_abertas}
          icon={<IconBolsa />}
          color="green"
          onClick={() => onNav('selecao')}
          detail={`${painel.bolsas_aguardando_aprovacao} aguardando aprovação`}
        />
        <StatCard
          label="Inscrições a analisar"
          value={painel.inscricoes_a_analisar}
          icon={<IconClipboardCheck />}
          color="orange"
          onClick={() => onNav('selecao')}
        />
        <StatCard
          label="Bolsistas ativos"
          value={painel.bolsistas_ativos}
          icon={<IconUsers />}
          color="purple"
          onClick={() => onNav('bolsistas')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Requer atenção" />
          <AttentionList
            items={[
              {
                id: 'inscricoes',
                label: 'Inscrições para homologar',
                count: atencao.inscricoes,
                tone: 'warning',
                onClick: () => onNav('selecao'),
              },
              {
                id: 'recursos',
                label: 'Recursos para julgar',
                count: atencao.recursos,
                tone: 'danger',
                onClick: () => onNav('selecao'),
              },
              {
                id: 'convites',
                label: 'Convites com documentação enviada',
                count: atencao.convites,
                tone: 'info',
                onClick: () => onNav('convites'),
              },
              {
                id: 'frequencias',
                label: rotuloFrequencias(frequencias),
                count: semFrequencia.length,
                tone: 'warning',
                onClick: () => onNav('frequencias'),
              },
              {
                id: 'relatorios',
                label: 'Relatórios finais aguardando seu parecer',
                count: atencao.relatorios,
                tone: 'warning',
                onClick: () => onNav('finalizacao'),
              },
              {
                id: 'vigencias',
                label: 'Bolsas com vigência encerrada para finalizar',
                count: atencao.vigencias_encerradas,
                tone: 'danger',
                onClick: () => onNav('finalizacao'),
              },
              {
                id: 'prontas',
                label: 'Bolsas prontas para finalizar',
                count: atencao.prontas_para_finalizar,
                tone: 'info',
                onClick: () => onNav('finalizacao'),
              },
            ]}
          />
        </Card>
        <Card>
          <SectionTitle title="Agenda de avaliações" />
          {painel.agenda.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma etapa agendada.</p>
          ) : (
            <ul className="my-0 list-none divide-y divide-gray-100 p-0">
              {painel.agenda.map((etapa) => (
                <EtapaDaAgenda key={etapa.id} etapa={etapa} />
              ))}
            </ul>
          )}
        </Card>
        {semFrequencia.length > 0 && (
          <Card className="lg:col-span-2">
            <SectionTitle
              title="Bolsistas sem frequência lançada"
              action={
                <Button size="sm" variant="primary" onClick={() => onNav('frequencias')}>
                  Lançar agora
                </Button>
              }
            />
            <div className="flex flex-wrap gap-2">
              {semFrequencia.map((bolsista) => (
                <span
                  key={bolsista.vinculo_id}
                  className="flex items-center gap-2 rounded-full border border-gray-200 py-1 pr-3 pl-1 text-sm"
                >
                  <Avatar initials={iniciais(bolsista.aluno_nome)} size={22} />
                  {bolsista.aluno_nome}
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
