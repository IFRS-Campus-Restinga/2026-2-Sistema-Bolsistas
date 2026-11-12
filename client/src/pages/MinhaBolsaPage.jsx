import { useEffect, useState } from 'react'
import { bolsistasFetch, dadosBancariosFetch, frequenciasFetch } from '../api'
import {
  Alert,
  Banner,
  Button,
  Card,
  Carregando,
  EmptyState,
  FileField,
  FormField,
  IconAward,
  IconCheckCircle,
  IconClock,
  IconDownload,
  IconFileText,
  IconUpload,
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

const UM_DIA = 24 * 60 * 60 * 1000

// Datas puras do backend ("2026-09-08"); `hoje` também vem do servidor.
function diasEntre(inicio, fim) {
  return Math.round((new Date(`${fim}T00:00:00`) - new Date(`${inicio}T00:00:00`)) / UM_DIA)
}

// Idade a partir de datas "AAAA-MM-DD"; `hoje` vem do servidor.
function menorDeIdadeEm(nascimento, hoje) {
  if (!nascimento || !hoje) return false
  const [anoN, mesN, diaN] = nascimento.split('-').map(Number)
  const [anoH, mesH, diaH] = hoje.split('-').map(Number)
  const idade = anoH - anoN - (mesH < mesN || (mesH === mesN && diaH < diaN) ? 1 : 0)
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

const abrir = (url) => window.open(url, '_blank', 'noopener')

function ErroDoCampo({ erros }) {
  return erros?.[0] ? <p className="text-xs text-red-600">{erros[0]}</p> : null
}

/** Data de nascimento e responsável legal: definem o modelo do termo. */
function DadosAdicionais({ dados, onSalvo, onCancelar }) {
  const toast = useToast()
  const [valores, setValores] = useState({
    data_nascimento: dados?.data_nascimento || '',
    nome_responsavel_legal: dados?.nome_responsavel_legal || '',
  })
  const [erros, setErros] = useState({})
  const [salvando, setSalvando] = useState(false)
  const menor = menorDeIdadeEm(valores.data_nascimento, dados?.hoje)

  function alterar(campo, valor) {
    setValores((atuais) => ({ ...atuais, [campo]: valor }))
    setErros((atuais) => ({ ...atuais, [campo]: undefined }))
  }

  async function salvar(event) {
    event.preventDefault()
    setSalvando(true)
    try {
      const response = await bolsistasFetch('/meus-dados-termo/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...valores,
          nome_responsavel_legal: menor ? valores.nome_responsavel_legal : '',
        }),
      })
      const resposta = await response.json().catch(() => null)
      if (!response.ok) {
        setErros(resposta ?? {})
        throw new Error(mensagemDeErro(resposta, 'Não foi possível salvar os dados.'))
      }
      toast({ message: 'Dados adicionais salvos.', tone: 'success' })
      onSalvo()
    } catch (error) {
      toast({ message: error.message, tone: 'error' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      <p className="text-sm text-gray-500">
        Sua idade define o modelo do termo. Menores de 18 anos assinam junto com o responsável
        legal.
      </p>
      <FormField label="Data de nascimento" className="mb-0">
        <TextInput
          type="date"
          required
          max={dados?.hoje}
          value={valores.data_nascimento}
          onChange={(event) => alterar('data_nascimento', event.target.value)}
        />
        <ErroDoCampo erros={erros.data_nascimento} />
      </FormField>
      {menor && (
        <FormField label="Nome completo do responsável legal" className="mb-0">
          <TextInput
            required
            value={valores.nome_responsavel_legal}
            onChange={(event) => alterar('nome_responsavel_legal', event.target.value)}
          />
          <ErroDoCampo erros={erros.nome_responsavel_legal} />
        </FormField>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" loading={salvando}>
          Salvar dados
        </Button>
        {onCancelar && (
          <Button type="button" size="sm" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}

function EnvioDoTermo({ vinculo, onEnviado }) {
  const toast = useToast()
  const [arquivo, setArquivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const reenvio = vinculo.termo?.aluno_assinou

  async function enviar() {
    setEnviando(true)
    setErro('')
    try {
      const body = new FormData()
      body.append('arquivo', arquivo)
      const response = await bolsistasFetch(`/vinculos/${vinculo.id}/termo/assinado/`, {
        method: 'POST',
        body,
      })
      const dados = await response.json().catch(() => null)
      if (!response.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível enviar o termo.'))
      setArquivo(null)
      toast({ message: 'Termo enviado para revisão do coordenador.', tone: 'success' })
      onEnviado()
    } catch (error) {
      setErro(error.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-xs text-gray-500">
        {reenvio ? 'Para trocar o arquivo enviado, ' : ''}
        Envie o termo assinado em DOCX, com até 10 MB.
      </p>
      {erro && <Alert tone="error">{erro}</Alert>}
      <FileField
        value={arquivo?.name || ''}
        onChange={setArquivo}
        accept=".docx"
        disabled={enviando}
      />
      <div>
        <Button size="sm" variant="primary" onClick={enviar} disabled={!arquivo} loading={enviando}>
          <IconUpload size={14} /> {reenvio ? 'Substituir termo assinado' : 'Enviar assinado'}
        </Button>
      </div>
    </div>
  )
}

function CartaoTermo({ vinculo, dadosTermo, onAtualizado }) {
  const [editandoDados, setEditandoDados] = useState(false)
  const termo = vinculo.termo
  const pendente = vinculo.status === 'AGUARDANDO_TERMO'
  const precisaDosDados = pendente && !termo?.aluno_assinou && !dadosTermo?.completos

  let conteudo
  if (termo?.assinado) {
    conteudo = (
      <>
        <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50/70 px-3 py-2.5 text-[13px] text-emerald-800">
          <IconCheckCircle size={16} /> Termo assinado enviado
        </div>
        <Button size="sm" className="mt-3" onClick={() => abrir(termo.arquivo_assinado_url)}>
          <IconDownload size={14} /> Baixar termo final
        </Button>
      </>
    )
  } else if (!pendente) {
    conteudo = (
      <p className="text-sm text-gray-500">Nenhum termo foi enviado pelo sistema neste vínculo.</p>
    )
  } else if (precisaDosDados || editandoDados) {
    conteudo = (
      <DadosAdicionais
        dados={dadosTermo}
        onCancelar={dadosTermo?.completos ? () => setEditandoDados(false) : undefined}
        onSalvo={() => {
          setEditandoDados(false)
          onAtualizado()
        }}
      />
    )
  } else {
    conteudo = (
      <>
        {termo?.aluno_assinou ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-blue-50/70 px-3 py-2.5 text-[13px] text-blue-800">
            <IconClock size={16} /> Aguardando a revisão do coordenador
          </div>
        ) : termo?.motivo_recusa_aluno ? (
          <Alert tone="error" title="O coordenador recusou o termo enviado">
            {termo.motivo_recusa_aluno}
          </Alert>
        ) : (
          <p className="text-sm text-gray-500">
            Baixe o termo, assine e envie para efetivar o seu vínculo.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() =>
              abrir(
                termo?.aluno_assinou
                  ? termo.arquivo_assinado_aluno_url
                  : vinculo.termo_para_assinar_url
              )
            }
          >
            <IconDownload size={14} /> {termo?.aluno_assinou ? 'Ver termo enviado' : 'Baixar termo'}
          </Button>
        </div>
        <EnvioDoTermo vinculo={vinculo} onEnviado={onAtualizado} />
        {!termo?.aluno_assinou && (
          <p className="mt-3 text-xs text-gray-500">
            Nascimento: {formatarData(dadosTermo.data_nascimento)}
            {dadosTermo.menor_de_idade && ` · Responsável: ${dadosTermo.nome_responsavel_legal}`}
            {' · '}
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-gray-700 underline"
              onClick={() => setEditandoDados(true)}
            >
              Alterar
            </button>
          </p>
        )}
      </>
    )
  }

  return (
    <Card>
      <SectionTitle title="Termo de compromisso" />
      {conteudo}
    </Card>
  )
}

/** Pendências do vínculo provisório, no topo da página. */
function PendenciasDoTermo({ vinculo, dadosTermo }) {
  if (vinculo.status !== 'AGUARDANDO_TERMO' || vinculo.termo?.aluno_assinou) return null
  if (!dadosTermo?.completos) {
    return (
      <Banner
        tone="warning"
        title="Preencha os dados adicionais"
        description="Informe sua data de nascimento no card do termo de compromisso para liberar o termo."
      />
    )
  }
  return (
    <Banner
      tone="warning"
      title="Aguardando preenchimento do termo de compromisso"
      description="Baixe, assine e envie o termo. O vínculo é efetivado depois da revisão do coordenador do projeto."
    />
  )
}

function BolsasFinalizadas({ vinculos }) {
  const [aberto, setAberto] = useState(false)
  if (vinculos.length === 0) return null
  return (
    <div className="mt-8">
      <SectionTitle
        title={`Bolsas finalizadas (${vinculos.length})`}
        action={
          <Button variant="ghost" size="sm" onClick={() => setAberto((atual) => !atual)}>
            {aberto ? 'Ocultar' : 'Mostrar'}
          </Button>
        }
      />
      {aberto && (
        <div className="grid gap-3 md:grid-cols-2">
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
                  size="sm"
                  onClick={() => abrir(item.termo.arquivo_assinado_url)}
                >
                  <IconDownload size={14} /> Baixar termo final
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
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
            dadosTermo: rDadosTermo.ok ? dadosDoTermo : null,
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

      <PendenciasDoTermo vinculo={vinculo} dadosTermo={dados.dadosTermo} />

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
        <CartaoTermo vinculo={vinculo} dadosTermo={dados.dadosTermo} onAtualizado={recarregar} />
        <CartaoDadosBancarios dados={dados.banco} onNav={onNav} />
        <CartaoRelatorio vinculo={vinculo} onEnviado={recarregar} />
      </div>

      <Pagamentos meses={meses} valorMensal={vinculo.valor_mensal} onNav={onNav} />

      <Desligamento pedido={pedido} onPedir={() => setDesligando(true)} />

      <BolsasFinalizadas vinculos={dados.finalizados ?? []} />

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
