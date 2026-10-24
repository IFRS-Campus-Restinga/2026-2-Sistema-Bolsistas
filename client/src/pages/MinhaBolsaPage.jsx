import { useEffect, useState } from 'react'
import { bolsistasFetch } from '../api'
import {
  Alert,
  Badge,
  Button,
  Carregando,
  FileField,
  IconGradCap,
  PageHeader,
  useToast,
} from '../components'
import { formatarData, formatarDataHora } from '../utils/dataHora'
import { formatarMoeda } from '../utils/formatarMoeda'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import MotivoModal from './MotivoModal'

function vigencia(vinculo) {
  if (!vinculo.data_inicio_vigencia || !vinculo.data_fim_vigencia) return 'Não definida'
  return `${formatarData(vinculo.data_inicio_vigencia)} a ${formatarData(vinculo.data_fim_vigencia)}`
}

function Informacao({ rotulo, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-500">{rotulo}</dt>
      <dd className="text-gray-800">{children}</dd>
    </div>
  )
}

function ParecerDoRelatorio({ relatorio }) {
  if (relatorio.situacao === 'APROVADO') {
    return <Alert tone="success">Relatório aprovado pelo coordenador do projeto.</Alert>
  }
  if (relatorio.situacao === 'REPROVADO') {
    return (
      <Alert tone="warning">
        Relatório reprovado: {relatorio.justificativa} Envie uma nova versão dentro do prazo.
      </Alert>
    )
  }
  return null
}

function RelatorioFinal({ vinculo, onEnviado }) {
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
    <section className="mt-5 border-t border-gray-100 pt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold text-gray-900">Relatório final</h3>
        <Badge status={relatorio?.situacao ?? 'NAO_SOLICITADO'} />
      </div>

      <p className="mb-3 text-sm text-gray-500">
        {vinculo.prazo_relatorio
          ? `Entrega até ${formatarData(vinculo.prazo_relatorio)}.`
          : 'O edital ainda não definiu o prazo de entrega.'}
        {relatorio?.arquivo && (
          <>
            {' '}
            Enviado em {formatarDataHora(relatorio.enviado_em)}:{' '}
            <a href={relatorio.arquivo} target="_blank" rel="noopener noreferrer">
              {relatorio.nome_original || 'relatório final'}
            </a>
          </>
        )}
      </p>

      {relatorio && <ParecerDoRelatorio relatorio={relatorio} />}
      {erro && <Alert tone="error">{erro}</Alert>}

      {vinculo.pode_enviar_relatorio ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[260px] flex-1">
            <FileField
              value={arquivo?.name || ''}
              onChange={setArquivo}
              accept=".pdf"
              disabled={enviando}
            />
          </div>
          <Button variant="accent" onClick={enviar} disabled={!arquivo} loading={enviando}>
            {relatorio?.arquivo ? 'Reenviar relatório' : 'Enviar relatório'}
          </Button>
        </div>
      ) : (
        relatorio?.situacao !== 'APROVADO' && (
          <p className="text-sm text-gray-500">{vinculo.motivo_bloqueio}</p>
        )
      )}
      {vinculo.pode_enviar_relatorio && (
        <p className="mt-2 text-xs text-gray-400">Somente PDF, com até 10 MB.</p>
      )}
    </section>
  )
}

function SituacaoDesligamento({ pedido }) {
  if (!pedido) return null
  if (pedido.status === 'PENDENTE') {
    return (
      <Alert tone="warning">
        Seu pedido de desligamento está aguardando a decisão do coordenador do projeto. Motivo:{' '}
        {pedido.motivo}
      </Alert>
    )
  }
  if (pedido.status === 'REJEITADA') {
    return (
      <Alert tone="error">
        Seu pedido de desligamento foi rejeitado. Motivo: {pedido.justificativa_decisao}
      </Alert>
    )
  }
  return <Alert tone="success">Seu desligamento foi aprovado.</Alert>
}

function CartaoVinculo({ vinculo, pedido, onEnviado, onPedirDesligamento }) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{vinculo.projeto_titulo}</h2>
          <p className="text-sm text-gray-500">
            {vinculo.edital_ano_codigo} · {vinculo.edital_nome}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge status={vinculo.status} />
          <Badge status={vinculo.bolsa_status} />
        </div>
      </header>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <Informacao rotulo="Coordenador do projeto">{vinculo.coordenador_nome}</Informacao>
        <Informacao rotulo="Tipo e modalidade">
          {vinculo.bolsa_tipo_display} · {vinculo.bolsa_modalidade_display}
        </Informacao>
        <Informacao rotulo="Carga horária">{vinculo.carga_horaria_semanal}h semanais</Informacao>
        <Informacao rotulo="Valor mensal">{formatarMoeda(vinculo.valor_mensal)}</Informacao>
        <Informacao rotulo="Vigência">{vigencia(vinculo)}</Informacao>
        <Informacao rotulo="Forma de ingresso">{vinculo.origem_display}</Informacao>
      </dl>

      <section className="mt-5 border-t border-gray-100 pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-bold text-gray-900">Desligamento</h3>
          {vinculo.status === 'ATIVO' && pedido?.status !== 'PENDENTE' && (
            <Button variant="danger" size="sm" onClick={() => onPedirDesligamento(vinculo)}>
              Pedir desligamento
            </Button>
          )}
        </div>
        <SituacaoDesligamento pedido={pedido} />
        {!pedido && vinculo.status === 'ATIVO' && (
          <p className="text-sm text-gray-500">
            Se você não puder continuar no projeto, envie um pedido com o motivo para avaliação do
            coordenador.
          </p>
        )}
      </section>

      <RelatorioFinal vinculo={vinculo} onEnviado={onEnviado} />
    </article>
  )
}

export default function MinhaBolsaPage() {
  const toast = useToast()
  const [vinculos, setVinculos] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)
  const [desligando, setDesligando] = useState(null)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const [responseVinculos, responsePedidos] = await Promise.all([
          bolsistasFetch('/meus-vinculos/'),
          bolsistasFetch('/meus-desligamentos/'),
        ])
        const [dadosVinculos, dadosPedidos] = await Promise.all([
          responseVinculos.json().catch(() => null),
          responsePedidos.json().catch(() => null),
        ])
        if (!responseVinculos.ok || !Array.isArray(dadosVinculos)) {
          throw new Error(mensagemDeErro(dadosVinculos, 'Não foi possível carregar sua bolsa.'))
        }
        if (!responsePedidos.ok || !Array.isArray(dadosPedidos)) {
          throw new Error(
            mensagemDeErro(dadosPedidos, 'Não foi possível carregar seus desligamentos.')
          )
        }
        if (ativo) {
          setVinculos(dadosVinculos)
          setPedidos(dadosPedidos)
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
  const pedidoPorVinculo = pedidos.reduce((porVinculo, pedido) => {
    if (!porVinculo[pedido.vinculo]) porVinculo[pedido.vinculo] = pedido
    return porVinculo
  }, {})

  async function pedirDesligamento(motivo) {
    const response = await bolsistasFetch(`/meus-vinculos/${desligando.id}/desligamento/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo }),
    })
    const dados = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(mensagemDeErro(dados, 'Não foi possível enviar o pedido.'))
    }
    setDesligando(null)
    toast({ message: 'Pedido de desligamento enviado.', tone: 'success' })
    recarregar()
  }

  return (
    <>
      <PageHeader title="Minha Bolsa" />

      {erro && <Alert tone="error">{erro}</Alert>}

      {!vinculos && !erro && <Carregando texto="Carregando sua bolsa..." />}

      {vinculos?.length === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-card">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <IconGradCap />
          </div>
          <p className="text-base font-medium text-gray-500">Você ainda não é bolsista.</p>
          <p className="mt-1 text-sm text-gray-400">
            Quando for indicado em uma seleção ou tiver um vínculo direto aprovado, sua bolsa
            aparece aqui.
          </p>
        </div>
      )}

      {vinculos?.length > 0 && (
        <div className="flex flex-col gap-5">
          {vinculos.map((vinculo) => (
            <CartaoVinculo
              key={vinculo.id}
              vinculo={vinculo}
              pedido={pedidoPorVinculo[vinculo.id]}
              onEnviado={recarregar}
              onPedirDesligamento={setDesligando}
            />
          ))}
        </div>
      )}

      {desligando && (
        <MotivoModal
          title="Pedir desligamento"
          description={`Informe por que você não poderá continuar na bolsa do projeto “${desligando.projeto_titulo}”. O coordenador do projeto analisará o pedido.`}
          confirmLabel="Enviar pedido"
          onClose={() => setDesligando(null)}
          onConfirm={pedirDesligamento}
        />
      )}
    </>
  )
}
