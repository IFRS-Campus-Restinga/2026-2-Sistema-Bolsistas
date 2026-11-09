import { useEffect, useState } from 'react'
import { monitoramentoFetch } from '../api'
import {
  Alert,
  AttentionList,
  BarRow,
  Button,
  Card,
  Carregando,
  IconBolsa,
  IconCalendarCheck,
  IconEdital,
  IconUsers,
  PageHeader,
  Prazo,
  SectionTitle,
  StatCard,
} from '../components'
import { formatarData } from '../utils/dataHora'

const ROTULO_DA_SITUACAO = {
  SOLICITADA: 'Solicitadas',
  ABERTA: 'Abertas',
  EM_SELECAO: 'Em seleção',
  PREENCHIDA: 'Preenchidas',
}

/** Início do coordenador de área: indicadores, pendências e prazos da área (US92). */
export default function InicioAreaPage({ areaLabel, onNav }) {
  const [painel, setPainel] = useState(null)
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const res = await monitoramentoFetch('/painel/area/')
        if (!res.ok) throw new Error('Não foi possível carregar o painel da área.')
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

  const cabecalho = (
    <PageHeader title="Visão geral da área" description={`${areaLabel} e bolsas indissociáveis.`} />
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

  const { atencao } = painel

  return (
    <>
      {cabecalho}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Editais em vigor"
          value={painel.editais_em_vigor}
          icon={<IconEdital />}
          color="green"
          onClick={() => onNav('editais')}
        />
        <StatCard
          label="Bolsas da área"
          value={painel.bolsas_da_area}
          icon={<IconBolsa />}
          color="blue"
          onClick={() => onNav('solicitacoes')}
          detail={`${painel.bolsas_aguardando_analise} aguardando sua análise`}
        />
        <StatCard
          label="Bolsistas ativos"
          value={painel.bolsistas_ativos}
          icon={<IconUsers />}
          color="purple"
          onClick={() => onNav('frequencias')}
        />
        <StatCard
          label="Pagamentos a autorizar"
          value={painel.pagamentos_a_autorizar}
          icon={<IconCalendarCheck />}
          color="orange"
          onClick={() => onNav('frequencias')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Requer atenção" />
          <AttentionList
            items={[
              {
                id: 'solicitacoes',
                label: 'Solicitações de bolsa para analisar',
                count: atencao.solicitacoes,
                tone: 'warning',
                onClick: () => onNav('solicitacoes'),
              },
              {
                id: 'movimentacoes',
                label: 'Movimentações para tomar ciência',
                count: atencao.movimentacoes,
                tone: 'info',
                onClick: () => onNav('movimentacoes'),
              },
              {
                id: 'frequencias',
                label: 'Frequências sem lançamento após o prazo',
                count: atencao.frequencias_em_atraso,
                tone: 'danger',
                onClick: () => onNav('pendencias'),
              },
              {
                id: 'finalizacoes',
                label: 'Bolsas finalizadas para tomar ciência',
                count: atencao.finalizacoes,
                tone: 'info',
                onClick: () => onNav('finalizacao'),
              },
              {
                id: 'vigencias',
                label: 'Bolsas com vigência encerrada não finalizadas',
                count: atencao.vigencias_encerradas,
                tone: 'danger',
                onClick: () => onNav('finalizacao'),
              },
            ]}
          />
        </Card>
        <Card>
          <SectionTitle title="Próximos prazos" />
          {painel.proximos_prazos.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum prazo próximo.</p>
          ) : (
            <ul className="my-0 list-none divide-y divide-gray-100 p-0">
              {painel.proximos_prazos.map((prazo) => (
                <li
                  key={`${prazo.rotulo}-${prazo.edital}`}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="text-sm text-gray-700">
                    {prazo.rotulo}
                    <span className="ml-1.5 font-mono text-xs text-gray-400">{prazo.edital}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-medium text-gray-900 tabular-nums">
                      {formatarData(prazo.data)}
                    </span>
                    <Prazo dias={prazo.dias} prefixo="" />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <SectionTitle title="Bolsas por situação" />
          <div className="space-y-3">
            {painel.bolsas_por_situacao.map(({ status, total }) => (
              <BarRow
                key={status}
                label={ROTULO_DA_SITUACAO[status]}
                value={total}
                max={painel.total_bolsas}
              />
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
