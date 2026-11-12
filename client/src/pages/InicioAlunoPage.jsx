import { useEffect, useState } from 'react'
import { monitoramentoFetch } from '../api'
import {
  Alert,
  Banner,
  Button,
  Card,
  Carregando,
  IconCalendarCheck,
  IconCheckCircle,
  IconClipboardCheck,
  IconCompass,
  IconMail,
  PageHeader,
  Progress,
  SectionTitle,
  StatCard,
  StatusPill,
} from '../components'
import { formatarData } from '../utils/dataHora'
import { formatarMoeda } from '../utils/formatarMoeda'

/** Início, fim e dias restantes da vigência; os dias vêm do servidor. */
function VigenciaBar({ vigencia }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs text-gray-500">
        <span>{formatarData(vigencia.inicio)}</span>
        <span>{vigencia.dias_restantes} dias restantes</span>
        <span>{formatarData(vigencia.fim)}</span>
      </div>
      <Progress value={vigencia.dias_decorridos} max={vigencia.dias_total} />
    </div>
  )
}

function ProximosPassos({ passos }) {
  return (
    <ul className="my-0 list-none space-y-1 p-0">
      {passos.map((passo) => (
        <li key={passo.label}>
          <button
            type="button"
            onClick={passo.acao}
            disabled={passo.feito}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent"
          >
            {passo.feito ? (
              <IconCheckCircle size={17} className="text-brand" />
            ) : (
              <span className="size-[17px] rounded-full border-2 border-gray-300" />
            )}
            <span className={passo.feito ? 'text-gray-400 line-through' : 'text-gray-800'}>
              {passo.label}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Início do aluno: oportunidades, minha bolsa e o que falta fazer (US92). */
export default function InicioAlunoPage({ nome, onNav }) {
  const [painel, setPainel] = useState(null)
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const res = await monitoramentoFetch('/painel/aluno/')
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
  const titulo = primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'

  if (erro) {
    return (
      <>
        <PageHeader title={titulo} />
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
        <PageHeader title={titulo} />
        <Carregando texto="Carregando painel..." />
      </>
    )
  }

  const bolsa = painel.minha_bolsa
  const vinculoProvisorio = bolsa?.status === 'AGUARDANDO_TERMO'
  const passos = [
    ...(vinculoProvisorio
      ? [
          {
            feito: painel.dados_termo_completos,
            label: 'Preencher dados adicionais',
            acao: () => onNav('minha-bolsa'),
          },
          {
            feito: !painel.termo_pendente,
            label: 'Enviar termo de compromisso assinado',
            acao: () => onNav('minha-bolsa'),
          },
        ]
      : []),
    {
      feito: painel.dados_bancarios_completos,
      label: 'Cadastrar dados bancários',
      acao: () => onNav('dados-bancarios'),
    },
    {
      feito: !painel.inscricao_em_rascunho,
      label: 'Concluir inscrição em rascunho',
      acao: () => onNav('inscricoes'),
    },
  ]

  return (
    <>
      <PageHeader title={titulo} description={painel.curso || undefined} />
      {painel.termo_pendente && (
        <Banner
          tone="warning"
          title="Aguardando preenchimento do termo de compromisso"
          description={
            painel.termo_motivo_recusa
              ? `O coordenador recusou o termo enviado: ${painel.termo_motivo_recusa}`
              : 'Seu vínculo só é efetivado depois que você envia o termo assinado e o coordenador do projeto aprova.'
          }
          action={
            <Button variant="primary" onClick={() => onNav('minha-bolsa')}>
              Preencher termo
            </Button>
          }
        />
      )}
      {!painel.termo_pendente && !painel.dados_bancarios_completos && bolsa && (
        <Banner
          tone="warning"
          title="Cadastre seus dados bancários"
          description="Sem eles o pagamento da sua bolsa não pode ser processado."
          action={
            <Button variant="primary" onClick={() => onNav('dados-bancarios')}>
              Cadastrar agora
            </Button>
          }
        />
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Bolsas abertas"
          value={painel.bolsas_abertas}
          icon={<IconCompass />}
          color="green"
          onClick={() => onNav('bolsas')}
        />
        <StatCard
          label="Minhas inscrições"
          value={painel.inscricoes}
          icon={<IconClipboardCheck />}
          color="blue"
          onClick={() => onNav('inscricoes')}
        />
        <StatCard
          label="Convites"
          value={painel.convites_pendentes}
          icon={<IconMail />}
          color="purple"
          onClick={() => onNav('convites')}
          detail="aguardando sua resposta"
        />
        <StatCard
          label="Frequências cumpridas"
          value={painel.frequencias_cumpridas}
          icon={<IconCalendarCheck />}
          color="gray"
          onClick={() => onNav('minha-frequencia')}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {bolsa && (
          <Card className="lg:col-span-3" onClick={() => onNav('minha-bolsa')}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Minha bolsa</span>
              <StatusPill status={bolsa.status} size="sm" />
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {bolsa.modalidade} · {bolsa.carga_horaria_semanal}h ·{' '}
              {formatarMoeda(bolsa.valor_mensal)}
              <span className="text-xs font-normal text-gray-400">/mês</span>
            </div>
            <div className="text-sm text-gray-500">{bolsa.projeto_titulo}</div>
            {bolsa.vigencia && (
              <div className="mt-4">
                <VigenciaBar vigencia={bolsa.vigencia} />
              </div>
            )}
          </Card>
        )}
        <Card className={bolsa ? 'lg:col-span-2' : 'lg:col-span-5'}>
          <SectionTitle title="Próximos passos" />
          <ProximosPassos passos={passos} />
        </Card>
      </div>
    </>
  )
}
