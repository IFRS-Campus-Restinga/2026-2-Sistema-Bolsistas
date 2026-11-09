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
  IconEdital,
  IconUserCog,
  IconUsers,
  PageHeader,
  SectionTitle,
  StatCard,
  Timeline,
} from '../components'
import { formatarDataHora } from '../utils/dataHora'

// Ações de auditoria que aparecem em vermelho na atividade recente, como no protótipo.
const ACOES_EM_DESTAQUE = ['REJEICAO', 'DESATIVACAO']

/**
 * Início do administrador: situação do sistema, com atalhos para o que precisa de
 * intervenção (US92, igual ao protótipo).
 */
export default function PainelAdministrativo({ onNavigate }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const response = await monitoramentoFetch('/painel/')
        const resultado = await response.json().catch(() => null)
        if (!response.ok || !resultado?.visao_geral) {
          throw new Error(resultado?.detail || 'Não foi possível carregar o painel.')
        }
        if (ativo) setDados(resultado)
      } catch (error) {
        if (ativo) setErro(error.message)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [tentativa])

  const cabecalho = (
    <PageHeader
      title="Visão geral"
      description="Situação do sistema em tempo real, com atalhos para o que precisa de intervenção."
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
  if (!dados) {
    return (
      <>
        {cabecalho}
        <Carregando texto="Carregando painel..." />
      </>
    )
  }

  const { visao_geral: visao, funil, pendencias } = dados
  const navegar = (aba) => () => onNavigate?.(aba)

  return (
    <>
      {cabecalho}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Editais em vigor"
          value={dados.editais_em_vigor}
          icon={<IconEdital />}
          color="green"
          onClick={navegar('editais')}
          detail={`${visao.editais_rascunho} em rascunho`}
        />
        <StatCard
          label="Bolsas ativas"
          value={visao.bolsas_ativas}
          icon={<IconBolsa />}
          color="blue"
          onClick={navegar('bolsas')}
          detail={`${visao.bolsas_aguardando_aprovacao} aguardando aprovação`}
        />
        <StatCard
          label="Bolsistas ativos"
          value={visao.bolsistas_ativos}
          icon={<IconUsers />}
          color="purple"
          onClick={navegar('bolsas')}
          detail={`${visao.bolsistas_vinculo_direto} por vínculo direto`}
        />
        <StatCard
          label="Usuários ativos"
          value={visao.usuarios_ativos}
          icon={<IconUserCog />}
          color="gray"
          onClick={navegar('usuarios')}
          detail={`${visao.usuarios_inativos} inativos`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <SectionTitle
            title="Requer atenção"
            description="Itens parados que podem precisar de intervenção."
          />
          <AttentionList
            items={[
              {
                id: 'bolsas',
                label: 'Bolsas aguardando aprovação',
                count: pendencias.bolsas_aguardando_aprovacao,
                tone: 'warning',
                onClick: navegar('bolsas'),
              },
              {
                id: 'recursos',
                label: 'Recursos sem julgamento',
                count: pendencias.recursos_sem_julgamento,
                tone: 'warning',
                onClick: navegar('inscricoes'),
              },
              {
                id: 'convites',
                label: 'Convites aguardando análise',
                count: pendencias.convites_aguardando_analise,
                tone: 'info',
                onClick: navegar('bolsas'),
              },
              {
                id: 'desligamentos',
                label: 'Desligamentos pendentes',
                count: visao.desligamentos_pendentes,
                tone: 'danger',
                onClick: navegar('bolsas'),
              },
              {
                id: 'frequencias',
                label: 'Frequências do mês passado sem lançamento',
                count: visao.frequencias_sem_lancamento,
                tone: 'warning',
                onClick: navegar('bolsas'),
              },
            ]}
          />
        </Card>
        <Card className="lg:col-span-3">
          <SectionTitle title="Funil de inscrições" description="Todos os editais publicados." />
          <div className="space-y-3">
            <BarRow label="Enviadas" value={funil.enviadas} max={funil.enviadas} />
            <BarRow label="Homologadas" value={funil.homologadas} max={funil.enviadas} />
            <BarRow label="Classificadas" value={funil.classificadas} max={funil.enviadas} />
            <BarRow label="Indicadas" value={funil.vinculadas} max={funil.enviadas} />
          </div>
        </Card>
        <Card className="lg:col-span-5">
          <SectionTitle
            title="Atividade recente"
            action={
              <Button variant="ghost" size="sm" onClick={navegar('auditoria')}>
                Ver auditoria
              </Button>
            }
          />
          <Timeline
            vazio="Nenhuma atividade registrada."
            items={dados.atividade_recente.slice(0, 5).map((log) => ({
              id: String(log.id),
              title: log.descricao,
              meta: `${log.usuario_nome || 'Sistema'} · ${formatarDataHora(log.data_hora)}`,
              tone: ACOES_EM_DESTAQUE.includes(log.acao) ? 'danger' : 'neutral',
            }))}
          />
        </Card>
      </div>
    </>
  )
}
