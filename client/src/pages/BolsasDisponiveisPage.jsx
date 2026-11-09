import { useEffect, useState } from 'react'
import { bolsasFetch, inscricoesFetch } from '../api'
import {
  Alert,
  Badge,
  Button,
  Card,
  Carregando,
  Cronograma,
  DocumentViewer,
  Drawer,
  EmptyState,
  IconArrowLeft,
  IconClock,
  IconCompass,
  IconEye,
  IconPaperclip,
  IconSearch,
  IconUsers,
  KeyValue,
  LocalEtapa,
  PageHeader,
  Prazo,
  RichTextView,
  StatusPill,
  Tag,
  TextInput,
} from '../components'
import { MODALIDADE_LABEL } from '../utils/bolsa'
import { formatarData, formatarDataHora } from '../utils/dataHora'
import { formatarMoeda } from '../utils/formatarMoeda'
import { formatarPeso } from '../utils/formatarPeso'
import InscricaoWizard from './InscricaoWizard'

const TIPO_LABEL = {
  ENSINO: 'Ensino',
  PESQUISA: 'Pesquisa',
  EXTENSAO: 'Extensão',
  INDISSOCIAVEL: 'Indissociável',
}

const FILTROS_DE_AREA = ['todas', 'PESQUISA', 'EXTENSAO', 'ENSINO', 'INDISSOCIAVEL']

/** Card da bolsa como no protótipo: o que o aluno precisa para decidir se inscrever. */
function BolsaDisponivelCard({ bolsa, acao, onDetalhes }) {
  const vagas = bolsa.quantidade_vagas
  const etapas = bolsa.etapas?.length ?? 0
  return (
    <Card padded={false} className="flex flex-col">
      <div className="flex-1 p-5">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Tag>{TIPO_LABEL[bolsa.tipo] || bolsa.tipo_display}</Tag>
          <Tag>{bolsa.modalidade}</Tag>
          <Tag icon={<IconClock />}>{bolsa.carga_horaria_semanal}h/sem</Tag>
        </div>
        <h3 className="text-[15px] leading-snug font-semibold text-gray-900">
          {bolsa.projeto_titulo}
        </h3>
        {bolsa.coordenador_projeto_nome && (
          <p className="mt-0.5 text-xs text-gray-500">{bolsa.coordenador_projeto_nome}</p>
        )}
        <div className="mt-3 text-xl font-semibold tracking-tight text-gray-900 tabular-nums">
          {formatarMoeda(bolsa.valor_mensal)}
          <span className="text-xs font-normal text-gray-400"> /mês</span>
        </div>
        <div className="mt-4 space-y-2.5 border-t border-gray-100 pt-4">
          <div>
            <div className="text-2xs font-medium text-gray-400 uppercase">Pré-requisitos</div>
            <p className="line-clamp-2 text-sm text-gray-700">
              {bolsa.prerequisitos || 'Não informado.'}
            </p>
          </div>
          <div>
            <div className="text-2xs font-medium text-gray-400 uppercase">Como é a seleção</div>
            <p className="line-clamp-2 text-sm text-gray-700">
              {bolsa.metodologia_avaliacao || 'Não informado.'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <IconUsers size={13} />
            {vagas} {vagas === 1 ? 'vaga' : 'vagas'}
          </span>
          <span>
            {etapas} {etapas === 1 ? 'etapa' : 'etapas'}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-5 py-3">
        {bolsa.dias_para_encerrar_inscricoes != null ? (
          <Prazo dias={bolsa.dias_para_encerrar_inscricoes} prefixo="Inscrições encerram" />
        ) : (
          <span />
        )}
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={onDetalhes}>
            Detalhes
          </Button>
          {acao}
        </div>
      </div>
    </Card>
  )
}

/** Detalhes da bolsa no painel lateral: valores, cronograma, requisitos, etapas e ementa. */
function BolsaDisponivelDrawer({ bolsa, acao, onFechar }) {
  const [verArquivo, setVerArquivo] = useState(false)
  const vigencia =
    bolsa.inicio_vigencia && bolsa.fim_vigencia
      ? `${formatarData(bolsa.inicio_vigencia)} – ${formatarData(bolsa.fim_vigencia)}`
      : 'A definir'

  return (
    <>
      <Drawer
        title={bolsa.projeto_titulo}
        subtitle={`${bolsa.modalidade} · ${MODALIDADE_LABEL[bolsa.modalidade] ?? bolsa.modalidade_display} · ${bolsa.carga_horaria_semanal}h semanais`}
        width={600}
        onClose={onFechar}
        footer={acao}
      >
        <div className="flex flex-col gap-6 p-5">
          <dl className="grid grid-cols-3 gap-4">
            <KeyValue label="Valor mensal">{formatarMoeda(bolsa.valor_mensal)}</KeyValue>
            <KeyValue label="Vagas">{bolsa.quantidade_vagas}</KeyValue>
            <KeyValue label="Vigência">{vigencia}</KeyValue>
          </dl>
          {bolsa.cronograma && (
            <section>
              <p className="mb-3 text-xs font-medium text-gray-500">Cronograma do edital</p>
              <Cronograma fases={bolsa.cronograma.fases} atual={bolsa.cronograma.atual} />
            </section>
          )}
          <section>
            <p className="mb-1 text-xs font-medium text-gray-500">Pré-requisitos</p>
            <p className="text-sm text-gray-700">{bolsa.prerequisitos || 'Não informado.'}</p>
          </section>
          <section>
            <p className="mb-1 text-xs font-medium text-gray-500">Como é a seleção</p>
            <p className="text-sm text-gray-700">
              {bolsa.metodologia_avaliacao || 'Não informado.'}
            </p>
          </section>
          <section>
            <p className="mb-2 text-xs font-medium text-gray-500">Etapas de avaliação</p>
            {bolsa.etapas?.length ? (
              <ul className="m-0 list-none divide-y divide-gray-100 rounded-lg border border-gray-200 p-0">
                {bolsa.etapas.map((etapa) => (
                  <li
                    key={etapa.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      {etapa.nome}
                      <span className="block text-xs text-gray-500">
                        {etapa.data_hora ? formatarDataHora(etapa.data_hora) : 'Data a definir'}
                        {etapa.local && (
                          <>
                            {' · '}
                            <LocalEtapa local={etapa.local} />
                          </>
                        )}
                      </span>
                    </span>
                    <Tag>peso {formatarPeso(etapa.peso_efetivo)}</Tag>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">As etapas ainda não foram definidas.</p>
            )}
          </section>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Sobre o projeto</p>
              {bolsa.projeto_arquivo_ementa && (
                <Button size="sm" variant="ghost" onClick={() => setVerArquivo(true)}>
                  <IconEye /> Ver PDF
                </Button>
              )}
            </div>
            {bolsa.projeto_ementa_html ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
                <RichTextView html={bolsa.projeto_ementa_html} maxHeight={240} />
              </div>
            ) : (
              <p className="text-sm text-gray-400">O coordenador ainda não escreveu a ementa.</p>
            )}
          </section>
        </div>
      </Drawer>
      {verArquivo && (
        <DocumentViewer
          docs={[
            {
              id: 'ementa',
              label: 'Ementa do projeto',
              fileName: bolsa.projeto_nome_arquivo || 'ementa',
              url: bolsa.projeto_arquivo_ementa,
            },
          ]}
          onClose={() => setVerArquivo(false)}
        />
      )}
    </>
  )
}

/**
 * Bolsas com inscrições abertas, em cards com busca e filtro por área, como no protótipo
 * (US93). Os detalhes abrem num painel lateral.
 */
export default function BolsasDisponiveisPage() {
  const [bolsas, setBolsas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)
  const [busca, setBusca] = useState('')
  const [area, setArea] = useState('todas')
  const [detalheId, setDetalheId] = useState(null)
  const [inscrevendo, setInscrevendo] = useState(null) // { bolsa, inscricaoExistente }

  useEffect(() => {
    let ativo = true
    async function carregarBolsas() {
      try {
        const res = await bolsasFetch('/disponiveis/')
        if (!res.ok) throw new Error('Não foi possível carregar as bolsas disponíveis.')
        const dados = await res.json()
        if (ativo) {
          setBolsas(Array.isArray(dados) ? dados : [])
          setErro('')
        }
      } catch (e) {
        if (ativo) setErro(e.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregarBolsas()
    return () => {
      ativo = false
    }
  }, [versao])

  async function continuarRascunho(bolsa) {
    const res = await inscricoesFetch('/')
    const inscricoes = res.ok ? await res.json() : []
    const rascunho = (Array.isArray(inscricoes) ? inscricoes : []).find(
      (inscricao) => inscricao.bolsa === bolsa.id && inscricao.status === 'RASCUNHO'
    )
    setInscrevendo({ bolsa, inscricaoExistente: rascunho ?? null })
  }

  function acaoDa(bolsa) {
    if (bolsa.minha_inscricao_status === 'RASCUNHO') {
      return (
        <Button size="sm" variant="primary" onClick={() => continuarRascunho(bolsa)}>
          Continuar inscrição
        </Button>
      )
    }
    if (bolsa.minha_inscricao_status) {
      return <StatusPill status={bolsa.minha_inscricao_status} label="Inscrito(a)" />
    }
    return (
      <Button
        size="sm"
        variant="primary"
        onClick={() => setInscrevendo({ bolsa, inscricaoExistente: null })}
      >
        Inscrever-se
      </Button>
    )
  }

  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const filtradas = bolsas.filter(
    (bolsa) =>
      (area === 'todas' || bolsa.tipo === area) &&
      (!termo ||
        `${bolsa.projeto_titulo} ${bolsa.prerequisitos} ${bolsa.modalidade}`
          .toLocaleLowerCase('pt-BR')
          .includes(termo))
  )
  const detalhe = bolsas.find((bolsa) => bolsa.id === detalheId)

  return (
    <>
      <PageHeader
        title="Bolsas disponíveis"
        description="Bolsas com inscrições abertas no momento."
      />
      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-80 max-w-full">
          <IconSearch
            size={15}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-400"
          />
          <TextInput
            placeholder="Buscar por projeto, modalidade ou requisito"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8!"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTROS_DE_AREA.map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setArea(opcao)}
              className={`cursor-pointer rounded-full border-0 px-3 py-1 text-xs font-medium transition-colors ${
                area === opcao
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300'
              }`}
            >
              {opcao === 'todas' ? 'Todas' : TIPO_LABEL[opcao]}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <Carregando texto="Carregando bolsas..." />
      ) : filtradas.length === 0 ? (
        <EmptyState
          icon={<IconCompass />}
          title="Nenhuma bolsa encontrada"
          description="Tente outra busca ou volte quando um novo edital abrir inscrições."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((bolsa) => (
            <BolsaDisponivelCard
              key={bolsa.id}
              bolsa={bolsa}
              acao={acaoDa(bolsa)}
              onDetalhes={() => setDetalheId(bolsa.id)}
            />
          ))}
        </div>
      )}

      {detalhe && !inscrevendo && (
        <BolsaDisponivelDrawer
          bolsa={detalhe}
          acao={acaoDa(detalhe)}
          onFechar={() => setDetalheId(null)}
        />
      )}

      {inscrevendo && (
        <InscricaoWizard
          bolsa={inscrevendo.bolsa}
          inscricaoExistente={inscrevendo.inscricaoExistente ?? undefined}
          onFechar={() => {
            setInscrevendo(null)
            setVersao((n) => n + 1)
          }}
          onConcluida={() => {
            setInscrevendo(null)
            setDetalheId(null)
            setVersao((n) => n + 1)
          }}
        />
      )}
    </>
  )
}

export function BolsaDetalhe({ bolsaId, inscricaoId, onVoltar }) {
  const [bolsa, setBolsa] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [wizardAberto, setWizardAberto] = useState(false)

  useEffect(() => {
    let ativo = true

    async function carregarBolsa() {
      try {
        const res = await (inscricaoId
          ? inscricoesFetch(`/${inscricaoId}/bolsa/`)
          : bolsasFetch(`/disponiveis/${bolsaId}/`))
        if (!res.ok) throw new Error('Não foi possível carregar os detalhes da bolsa.')
        const dados = await res.json()
        if (ativo) setBolsa(dados)
      } catch (e) {
        if (ativo) setErro(e.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarBolsa()

    return () => {
      ativo = false
    }
  }, [bolsaId, inscricaoId])

  if (carregando) return <Carregando texto="Carregando bolsa..." />

  if (erro || !bolsa) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={onVoltar}>
          <IconArrowLeft /> Voltar
        </Button>
        <Alert tone="error">{erro || 'Bolsa não encontrada.'}</Alert>
      </>
    )
  }

  const jaInscrito = !!inscricaoId || !!bolsa.minha_inscricao_status
  const mensagemJaInscrito =
    bolsa.minha_inscricao_status === 'RASCUNHO'
      ? 'Você já iniciou uma inscrição para esta bolsa, continue em Minhas Inscrições.'
      : 'Você já está inscrito nesta bolsa.'

  return (
    <>
      <PageHeader title={bolsa.projeto_titulo} badge={<Badge status={bolsa.status} />} />

      <div className="mb-6 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
        <p>
          <strong>Edital:</strong> {bolsa.edital_nome}
        </p>
        <p>
          <strong>Tipo:</strong> {bolsa.tipo_display}
        </p>
        <p>
          <strong>Carga horária:</strong> {bolsa.carga_horaria_semanal}h/semana
        </p>
        <p>
          <strong>Valor mensal:</strong> R$ {bolsa.valor_mensal}
        </p>
        <p>
          <strong>Vagas:</strong> {bolsa.quantidade_vagas}
        </p>
        {bolsa.nota_minima != null && (
          <p>
            <strong>Nota mínima:</strong> {bolsa.nota_minima}
          </p>
        )}
        <p>
          <strong>Pré-requisitos:</strong> {bolsa.prerequisitos || 'Não informado.'}
        </p>
        <p>
          <strong>Metodologia de avaliação:</strong>{' '}
          {bolsa.metodologia_avaliacao || 'Não informado.'}
        </p>
        {bolsa.etapas?.length > 0 && (
          <div>
            <strong>Etapas de avaliação:</strong>
            <ul className="mt-1 pl-5">
              {bolsa.etapas.map((etapa) => (
                <li key={etapa.id}>
                  {etapa.nome}: peso {formatarPeso(etapa.peso_efetivo)}
                  {etapa.data_hora && <> · {formatarDataHora(etapa.data_hora)}</>}
                  {etapa.local && (
                    <>
                      {' · '}
                      <LocalEtapa local={etapa.local} />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p>
          <strong>Matriz / ementa do projeto:</strong>{' '}
          {bolsa.projeto_arquivo_ementa ? (
            <a
              href={bolsa.projeto_arquivo_ementa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1"
            >
              <IconPaperclip size={14} />
              {bolsa.projeto_nome_arquivo || 'Abrir arquivo'}
            </a>
          ) : (
            'Não anexado.'
          )}
        </p>
      </div>

      {jaInscrito && <Alert tone="warning">{mensagemJaInscrito}</Alert>}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onVoltar}>
          Voltar
        </Button>
        {!jaInscrito && (
          <Button variant="accent" onClick={() => setWizardAberto(true)}>
            Inscrever-se nesta bolsa
          </Button>
        )}
      </div>

      {wizardAberto && (
        <InscricaoWizard
          bolsa={bolsa}
          onFechar={() => setWizardAberto(false)}
          onConcluida={() => setWizardAberto(false)}
        />
      )}
    </>
  )
}
