import { useEffect, useState } from 'react'
import { bolsistasFetch, dadosBancariosFetch, frequenciasFetch } from '../api'
import {
  Alert,
  Button,
  Card,
  Carregando,
  EmptyState,
  FileField,
  IconAward,
  IconDownload,
  IconFileText,
  KeyValue,
  PageHeader,
  SectionTitle,
  StatusPill,
  useToast,
} from '../components'
import { formatarData, formatarDataHora } from '../utils/dataHora'
import { formatarMoeda } from '../utils/formatarMoeda'
import { formatarMesCurto } from '../utils/mesReferencia'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import MotivoModal from './MotivoModal'

const MODALIDADE_LABEL = {
  BICT: 'Iniciação Científica',
  BIDTI: 'Desenv. Tecnológico e Inovação',
  BAT: 'Apoio Técnico',
}

const UM_DIA = 24 * 60 * 60 * 1000

// Datas puras do backend ("2026-09-08"); `hoje` também vem do servidor.
function diasEntre(inicio, fim) {
  return Math.round((new Date(`${fim}T00:00:00`) - new Date(`${inicio}T00:00:00`)) / UM_DIA)
}

function VigenciaBar({ inicio, fim, hoje }) {
  const total = diasEntre(inicio, fim)
  const passado = Math.max(0, diasEntre(inicio, hoje))
  const restantes = Math.max(0, diasEntre(hoje, fim))
  const percentual = total > 0 ? Math.min(100, (passado / total) * 100) : 0

  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs text-gray-500">
        <span>{formatarData(inicio)}</span>
        <span>{restantes} dias restantes</span>
        <span>{formatarData(fim)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-brand" style={{ width: `${percentual}%` }} />
      </div>
    </div>
  )
}

function CartaoTermo() {
  return (
    <Card>
      <SectionTitle title="Termo de compromisso" />
      <p className="text-sm text-gray-500">
        A geração e o envio do termo assinado pelo sistema ainda não estão disponíveis.
      </p>
    </Card>
  )
}

function CartaoDadosBancarios({ dados, onNav }) {
  const completo = dados?.cadastro_completo
  return (
    <Card>
      <SectionTitle title="Dados bancários" />
      {completo ? (
        <dl className="grid grid-cols-2 gap-3">
          <KeyValue label="Banco">{dados.banco}</KeyValue>
          <KeyValue label="Agência / conta">
            {dados.agencia} / {dados.conta}
          </KeyValue>
        </dl>
      ) : (
        <Alert tone="warning">Não cadastrados.</Alert>
      )}
      <Button size="sm" className="mt-3" onClick={() => onNav('dados-bancarios')}>
        {completo ? 'Alterar' : 'Cadastrar'}
      </Button>
    </Card>
  )
}

function CartaoRelatorio({ vinculo, onEnviado }) {
  const toast = useToast()
  const [arquivo, setArquivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const { relatorio } = vinculo

  async function enviar() {
    setEnviando(true)
    setErro('')
    try {
      const body = new FormData()
      body.append('arquivo', arquivo)
      const response = await bolsistasFetch(`/vinculos/${vinculo.id}/relatorio-final/`, {
        method: 'POST',
        body,
      })
      const dados = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(mensagemDeErro(dados, 'Não foi possível enviar o relatório.'))
      }
      setArquivo(null)
      toast({ message: 'Relatório final enviado para avaliação.', tone: 'success' })
      onEnviado()
    } catch (error) {
      setErro(error.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card>
      <SectionTitle title="Relatório final" />
      {!relatorio ? (
        <p className="text-sm text-gray-500">
          {vinculo.data_fim_vigencia
            ? `Será solicitado próximo ao fim da vigência (${formatarData(vinculo.data_fim_vigencia)}).`
            : 'Será solicitado pelo coordenador do projeto próximo ao fim da vigência.'}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <StatusPill status={relatorio.situacao} />
            {relatorio.fora_do_prazo && <StatusPill label="Enviado fora do prazo" tone="warning" />}
          </div>

          {relatorio.modelo && (
            <a
              href={relatorio.modelo}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex w-full items-center gap-2.5 rounded-controle border border-gray-200 px-3 py-2 text-left no-underline hover:bg-gray-50"
            >
              <IconFileText size={16} className="text-gray-400" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-900">
                  Modelo do coordenador
                </span>
                <span className="block truncate text-xs text-gray-500">
                  {relatorio.nome_original_modelo || 'modelo de relatório'}
                </span>
              </span>
              <IconDownload size={15} className="text-gray-400" />
            </a>
          )}

          {relatorio.arquivo && (
            <p className="mt-2 text-xs text-gray-500">
              Enviado em {formatarDataHora(relatorio.enviado_em)}:{' '}
              <a href={relatorio.arquivo} target="_blank" rel="noopener noreferrer">
                {relatorio.nome_original || 'relatório final'}
              </a>
            </p>
          )}

          {relatorio.situacao === 'REPROVADO' && relatorio.justificativa && (
            <p className="mt-2 text-sm text-gray-600">{relatorio.justificativa}</p>
          )}

          {vinculo.pode_enviar_relatorio && (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-xs text-gray-500">
                {vinculo.prazo_relatorio_encerrado
                  ? `O prazo terminou em ${formatarData(vinculo.prazo_relatorio)}; o envio ficará marcado como fora do prazo.`
                  : `Entrega até ${formatarData(vinculo.prazo_relatorio)}. Somente PDF, até 10 MB.`}
              </p>
              {erro && <Alert tone="error">{erro}</Alert>}
              <FileField
                value={arquivo?.name || ''}
                onChange={setArquivo}
                accept=".pdf"
                disabled={enviando}
              />
              <div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={enviar}
                  disabled={!arquivo}
                  loading={enviando}
                >
                  {relatorio.arquivo ? 'Reenviar relatório' : 'Enviar relatório'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

function Pagamentos({ meses, valorMensal, onNav }) {
  const lancados = meses.filter((mes) => mes.status_pagamento)
  return (
    <div className="mt-6">
      <SectionTitle
        title="Pagamentos"
        action={
          <Button variant="ghost" size="sm" onClick={() => onNav('minha-frequencia')}>
            Ver frequência
          </Button>
        }
      />
      {lancados.length === 0 ? (
        <EmptyState compact title="Nenhum mês lançado ainda" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {lancados.map((mes) => (
            <Card key={mes.mes_referencia} className="p-4!">
              <div className="text-xs text-gray-500 capitalize">
                {formatarMesCurto(mes.mes_referencia)}
              </div>
              <div className="mt-1 text-[15px] font-semibold text-gray-900 tabular-nums">
                {mes.status_pagamento === 'NEGADO' ? '—' : formatarMoeda(valorMensal)}
              </div>
              <div className="mt-2">
                <StatusPill status={mes.status_pagamento} size="sm" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Desligamento({ pedido, onPedir }) {
  return (
    <div className="mt-8 rounded-card border border-red-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Pedir desligamento</div>
          <p className="text-sm text-gray-500">
            O coordenador do projeto analisa o pedido. Você será notificado(a) da decisão.
          </p>
        </div>
        {pedido?.status === 'PENDENTE' ? (
          <StatusPill status="PENDENTE" label="Pedido em análise" />
        ) : (
          <Button variant="danger" onClick={onPedir}>
            Pedir desligamento
          </Button>
        )}
      </div>
      {pedido?.status === 'REJEITADA' && (
        <p className="mt-3 text-sm text-gray-600">
          Seu último pedido foi rejeitado: {pedido.justificativa_decisao}
        </p>
      )}
    </div>
  )
}

export default function MinhaBolsaPage({ onNav }) {
  const toast = useToast()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)
  const [desligando, setDesligando] = useState(false)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const [rVinculos, rPedidos, rBanco, rFrequencias] = await Promise.all([
          bolsistasFetch('/meus-vinculos/'),
          bolsistasFetch('/meus-desligamentos/'),
          dadosBancariosFetch('/'),
          frequenciasFetch('/minhas/'),
        ])
        const [vinculos, pedidos, banco, historico] = await Promise.all(
          [rVinculos, rPedidos, rBanco, rFrequencias].map((r) => r.json().catch(() => null))
        )
        if (!rVinculos.ok || !Array.isArray(vinculos)) {
          throw new Error(mensagemDeErro(vinculos, 'Não foi possível carregar sua bolsa.'))
        }
        if (ativo) {
          setDados({
            // O aluno só pode ter um vínculo ativo; os encerrados ficam fora desta tela.
            vinculo: vinculos.find((vinculo) => vinculo.status === 'ATIVO') ?? null,
            pedidos: Array.isArray(pedidos) ? pedidos : [],
            banco: rBanco.ok ? banco : null,
            historico: Array.isArray(historico) ? historico : [],
          })
          setErro('')
        }
      } catch (error) {
        if (ativo) setErro(error.message)
      }
    }

    carregar()
    return () => {
      ativo = false
    }
  }, [versao])

  const recarregar = () => setVersao((atual) => atual + 1)

  if (erro) {
    return (
      <>
        <PageHeader title="Minha bolsa" />
        <Alert tone="error">{erro}</Alert>
      </>
    )
  }
  if (!dados) return <Carregando texto="Carregando sua bolsa..." />

  const { vinculo } = dados
  if (!vinculo) {
    return (
      <>
        <PageHeader title="Minha bolsa" />
        <EmptyState
          icon={<IconAward />}
          title="Você ainda não tem uma bolsa ativa"
          description="Inscreva-se em uma bolsa ou aceite um convite para começar."
          action={
            <Button variant="primary" onClick={() => onNav('bolsas')}>
              Ver bolsas disponíveis
            </Button>
          }
        />
      </>
    )
  }

  const pedido = dados.pedidos.find((item) => item.vinculo === vinculo.id)
  const meses = dados.historico.find((item) => item.vinculo_id === vinculo.id)?.meses ?? []

  async function pedirDesligamento(motivo) {
    const response = await bolsistasFetch(`/meus-vinculos/${vinculo.id}/desligamento/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo }),
    })
    const resposta = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(mensagemDeErro(resposta, 'Não foi possível enviar o pedido.'))
    }
    setDesligando(false)
    toast({ message: 'Pedido de desligamento enviado.', tone: 'success' })
    recarregar()
  }

  return (
    <>
      <PageHeader title="Minha bolsa" badge={<StatusPill status={vinculo.status} />} />

      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500">{vinculo.projeto_titulo}</div>
            <div className="mt-0.5 text-xl font-semibold tracking-tight text-gray-900">
              {vinculo.bolsa_modalidade} · {vinculo.carga_horaria_semanal}h semanais
            </div>
            <div className="text-sm text-gray-500">
              {MODALIDADE_LABEL[vinculo.bolsa_modalidade] ?? vinculo.bolsa_modalidade_display} ·
              Coordenação: {vinculo.coordenador_nome}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Valor mensal</div>
            <div className="text-xl font-semibold text-gray-900 tabular-nums">
              {formatarMoeda(vinculo.valor_mensal)}
            </div>
          </div>
        </div>
        <div className="mt-5">
          {vinculo.data_inicio_vigencia && vinculo.data_fim_vigencia ? (
            <VigenciaBar
              inicio={vinculo.data_inicio_vigencia}
              fim={vinculo.data_fim_vigencia}
              hoje={vinculo.hoje}
            />
          ) : (
            <p className="text-xs text-gray-500">Vigência ainda não definida.</p>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CartaoTermo />
        <CartaoDadosBancarios dados={dados.banco} onNav={onNav} />
        <CartaoRelatorio vinculo={vinculo} onEnviado={recarregar} />
      </div>

      <Pagamentos meses={meses} valorMensal={vinculo.valor_mensal} onNav={onNav} />

      <Desligamento pedido={pedido} onPedir={() => setDesligando(true)} />

      {desligando && (
        <MotivoModal
          title="Pedir desligamento"
          description={`Informe por que você não poderá continuar na bolsa do projeto “${vinculo.projeto_titulo}”. O coordenador do projeto analisará o pedido.`}
          confirmLabel="Enviar pedido"
          onClose={() => setDesligando(false)}
          onConfirm={pedirDesligamento}
        />
      )}
    </>
  )
}
