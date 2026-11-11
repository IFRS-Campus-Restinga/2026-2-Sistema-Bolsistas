import { useEffect, useState } from 'react'
import { bolsistasFetch, dadosBancariosFetch, frequenciasFetch } from '../api'
import {
  Alert,
  Button,
  Card,
  Carregando,
  EmptyState,
  FileField,
  FormField,
  IconAward,
  IconDownload,
  IconFileText,
  KeyValue,
  PageHeader,
  SectionTitle,
  StatusPill,
  TextInput,
  useToast,
} from '../components'
import { formatarData, formatarDataHora } from '../utils/dataHora'
import { MODALIDADE_LABEL } from '../utils/bolsa'
import { formatarMoeda } from '../utils/formatarMoeda'
import { formatarMesCurto } from '../utils/mesReferencia'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import MotivoModal from './MotivoModal'
import TermoAssinadoModal from './TermoAssinadoModal'

const UM_DIA = 24 * 60 * 60 * 1000

// Datas puras do backend ("2026-09-08"); `hoje` também vem do servidor.
function diasEntre(inicio, fim) {
  return Math.round((new Date(`${fim}T00:00:00`) - new Date(`${inicio}T00:00:00`)) / UM_DIA)
}

function menorDeIdade(dataNascimento) {
  if (!dataNascimento) return false
  const nascimento = new Date(`${dataNascimento}T12:00:00`)
  if (Number.isNaN(nascimento.getTime())) return false
  const hoje = new Date()
  let idade = hoje.getFullYear() - nascimento.getFullYear()
  const aniversarioAindaNaoOcorreu =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate())
  if (aniversarioAindaNaoOcorreu) idade -= 1
  return idade < 18
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

function CartaoTermo({ vinculo, onEnviar }) {
  const termo = vinculo.termo
  const rotulo = termo?.assinado
    ? 'Termo finalizado'
    : termo?.aluno_assinou
      ? 'Aguardando coordenador'
      : termo
        ? 'Aguardando sua assinatura'
        : 'Aguardando geração'

  return (
    <Card>
      <SectionTitle
        title="Termo de compromisso"
        action={<StatusPill status={termo?.assinado ? 'ATIVO' : vinculo.status} label={rotulo} />}
      />
      {!termo ? (
        <p className="text-sm text-gray-500">O coordenador ainda não gerou o termo.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(
                termo.assinado
                  ? termo.arquivo_assinado_url
                  : termo.aluno_assinou
                    ? termo.arquivo_assinado_aluno_url
                    : termo.arquivo_gerado_url,
                '_blank',
                'noopener'
              )
            }
          >
            {termo.assinado
              ? 'Baixar termo final'
              : termo.aluno_assinou
                ? 'Baixar minha versão'
                : 'Baixar termo em DOCX'}
          </Button>
          {!termo.assinado && (
            <Button variant="primary" size="sm" onClick={() => onEnviar(vinculo)}>
              {termo.aluno_assinou ? 'Substituir minha assinatura' : 'Enviar minha assinatura'}
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

function BolsasFinalizadas({ vinculos }) {
  if (vinculos.length === 0) return null
  return (
    <details className="mt-6 rounded-card border border-gray-200 bg-white">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-gray-700">
        Bolsas finalizadas ({vinculos.length})
      </summary>
      <div className="grid gap-3 border-t border-gray-100 p-4 md:grid-cols-2">
        {vinculos.map((item) => (
          <Card key={item.id} className="p-4!">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-gray-900">{item.projeto_titulo}</div>
                <div className="text-xs text-gray-500">
                  {item.edital_ano_codigo} · {item.bolsa_modalidade_display}
                </div>
              </div>
              <StatusPill status={item.status} size="sm" />
            </div>
            {item.termo?.assinado && (
              <Button
                className="mt-3"
                variant="outline"
                size="sm"
                onClick={() => window.open(item.termo.arquivo_assinado_url, '_blank', 'noopener')}
              >
                Baixar termo final
              </Button>
            )}
          </Card>
        ))}
      </div>
    </details>
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
  const [enviandoTermo, setEnviandoTermo] = useState(null)
  const [dadosTermo, setDadosTermo] = useState({ data_nascimento: '', nome_responsavel_legal: '' })
  const [salvandoDados, setSalvandoDados] = useState(false)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const [rVinculos, rPedidos, rBanco, rFrequencias, rDadosTermo] = await Promise.all([
          bolsistasFetch('/meus-vinculos/'),
          bolsistasFetch('/meus-desligamentos/'),
          dadosBancariosFetch('/'),
          frequenciasFetch('/minhas/'),
          bolsistasFetch('/meus-dados-termo/'),
        ])
        const [vinculos, pedidos, banco, historico, dadosDoTermo] = await Promise.all(
          [rVinculos, rPedidos, rBanco, rFrequencias, rDadosTermo].map((r) =>
            r.json().catch(() => null)
          )
        )
        if (!rVinculos.ok || !Array.isArray(vinculos)) {
          throw new Error(mensagemDeErro(vinculos, 'Não foi possível carregar sua bolsa.'))
        }
        if (ativo) {
          setDados({
            vinculo:
              vinculos.find(
                (item) =>
                  ['ATIVO', 'AGUARDANDO_TERMO'].includes(item.status) &&
                  !['ENCERRADA', 'CANCELADA', 'REJEITADA'].includes(item.bolsa_status)
              ) ?? null,
            finalizados: vinculos.filter(
              (item) =>
                item.status === 'DESLIGADO' ||
                ['ENCERRADA', 'CANCELADA', 'REJEITADA'].includes(item.bolsa_status)
            ),
            pedidos: Array.isArray(pedidos) ? pedidos : [],
            banco: rBanco.ok ? banco : null,
            historico: Array.isArray(historico) ? historico : [],
          })
          if (rDadosTermo.ok && dadosDoTermo) {
            setDadosTermo({
              data_nascimento: dadosDoTermo.data_nascimento || '',
              nome_responsavel_legal: dadosDoTermo.nome_responsavel_legal || '',
            })
          }
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

  async function salvarDadosTermo(event) {
    event.preventDefault()
    setSalvandoDados(true)
    try {
      const response = await bolsistasFetch('/meus-dados-termo/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosTermo),
      })
      const resposta = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(mensagemDeErro(resposta, 'Não foi possível salvar os dados.'))
      }
      toast({ message: 'Dados do Termo de Compromisso salvos.', tone: 'success' })
      recarregar()
    } catch (error) {
      toast({ message: error.message, tone: 'error' })
    } finally {
      setSalvandoDados(false)
    }
  }

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
        <BolsasFinalizadas vinculos={dados.finalizados ?? []} />
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

      <form onSubmit={salvarDadosTermo} className="mb-4">
        <Card>
          <SectionTitle title="Dados para o Termo de Compromisso" />
          {menorDeIdade(dadosTermo.data_nascimento) &&
            !dadosTermo.nome_responsavel_legal.trim() && (
              <Alert tone="warning">
                Para gerar o termo de um estudante menor de idade, informe o nome completo do
                responsável legal.
              </Alert>
            )}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Data de nascimento" className="mb-0">
              <TextInput
                type="date"
                required
                value={dadosTermo.data_nascimento}
                onChange={(event) =>
                  setDadosTermo((atual) => ({ ...atual, data_nascimento: event.target.value }))
                }
              />
            </FormField>
            <FormField
              label="Nome completo do responsável legal, se menor de 18 anos"
              className="mb-0"
            >
              <TextInput
                value={dadosTermo.nome_responsavel_legal}
                onChange={(event) =>
                  setDadosTermo((atual) => ({
                    ...atual,
                    nome_responsavel_legal: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" variant="primary" loading={salvandoDados}>
              Salvar dados
            </Button>
          </div>
        </Card>
      </form>

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
        <CartaoTermo vinculo={vinculo} onEnviar={setEnviandoTermo} />
        <CartaoDadosBancarios dados={dados.banco} onNav={onNav} />
        <CartaoRelatorio vinculo={vinculo} onEnviado={recarregar} />
      </div>

      <Pagamentos meses={meses} valorMensal={vinculo.valor_mensal} onNav={onNav} />

      <Desligamento pedido={pedido} onPedir={() => setDesligando(true)} />

      <BolsasFinalizadas vinculos={dados.finalizados ?? []} />

      {enviandoTermo && (
        <TermoAssinadoModal
          vinculo={enviandoTermo}
          onFechar={() => setEnviandoTermo(null)}
          onEnviado={() => {
            setEnviandoTermo(null)
            toast({
              message: 'Sua assinatura foi enviada para revisão do coordenador.',
              tone: 'success',
            })
            recarregar()
          }}
        />
      )}

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
