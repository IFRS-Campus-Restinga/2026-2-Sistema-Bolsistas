import { useEffect, useState } from 'react'
import {
  bolsasFetch,
  bolsistasFetch,
  editaisFetch,
  projetosFetch,
  vinculoDiretoFetch,
} from '../api'
import {
  Alert,
  Avatar,
  Badge,
  BolsaCard,
  Button,
  Card,
  Carregando,
  Drawer,
  EmptyState,
  FileField,
  FormActions,
  FormField,
  IconAlertTriangle,
  IconArrowLeft,
  IconBolsa,
  IconFolder,
  IconPlus,
  KeyValue,
  Modal,
  PageHeader,
  Progress,
  SectionTitle,
  Select,
  StatusPill,
  Tag,
  TextArea,
  TextInput,
  useConfirm,
  useToast,
} from '../components'
import { enviarEmentaProjeto, validarArquivoEmenta } from '../utils/ementaProjeto'
import EmentaProjetoCard from './EmentaProjetoCard'
import EtapasEditor from './EtapasEditor'
import { MODALIDADE_LABEL } from '../utils/bolsa'
import { formatarData } from '../utils/dataHora'
import { formatarMoeda } from '../utils/formatarMoeda'
import { iniciais } from '../utils/iniciais'
import ConvidarBolsistaModal from './ConvidarBolsistaModal'

const TIPO_OPTIONS = [
  { value: 'ENSINO', label: 'Ensino' },
  { value: 'PESQUISA', label: 'Pesquisa' },
  { value: 'EXTENSAO', label: 'Extensão' },
  { value: 'INDISSOCIAVEL', label: 'Indissociável' },
]

export default function MeusProjetosPage() {
  const [projetoSelecionadoId, setProjetoSelecionadoId] = useState(null)

  if (projetoSelecionadoId) {
    return (
      <ProjetoDetalhe
        projetoId={projetoSelecionadoId}
        onVoltar={() => setProjetoSelecionadoId(null)}
      />
    )
  }

  return <ListaProjetos onGerenciar={setProjetoSelecionadoId} />
}

// ─── lista de projetos ─────────────────────────────────────────────────────

/** Card do projeto como no protótipo: tipos, bolsas com status e ocupação das vagas. */
function ProjetoCard({ projeto, onClick }) {
  const bolsas = projeto.bolsas_resumo ?? []
  return (
    <Card onClick={onClick}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex flex-wrap gap-1">
          {(projeto.tipos_bolsa ?? []).map((tipo) => (
            <Tag key={tipo}>{tipo}</Tag>
          ))}
        </span>
        <StatusPill status={projeto.status} size="sm" />
      </div>
      <h3 className="text-base font-semibold text-gray-900">{projeto.titulo}</h3>
      {projeto.descricao && (
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{projeto.descricao}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {bolsas.map((bolsa) => (
          <span
            key={bolsa.id}
            className="flex items-center gap-1.5 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-700"
          >
            <span className="font-medium">
              {bolsa.modalidade} {bolsa.carga_horaria_semanal}h
            </span>
            <StatusPill status={bolsa.status} size="sm" />
          </span>
        ))}
        {bolsas.length === 0 && (
          <span className="text-xs text-gray-400">Nenhuma bolsa solicitada ainda.</span>
        )}
      </div>
      <div className="mt-4 border-t border-gray-100 pt-3">
        <div className="mb-1.5 flex justify-between text-xs text-gray-500">
          <span>Vagas preenchidas</span>
          <span className="tabular-nums">
            {projeto.bolsistas_ativos}/{projeto.vagas_total}
          </span>
        </div>
        <Progress value={projeto.bolsistas_ativos} max={projeto.vagas_total} />
      </div>
    </Card>
  )
}

function ListaProjetos({ onGerenciar }) {
  const toast = useToast()

  const [projetos, setProjetos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [arquivoEmenta, setArquivoEmenta] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregarProjetos() {
      try {
        const res = await projetosFetch('/')
        if (!res.ok) throw new Error('Não foi possível carregar os projetos.')
        const dados = await res.json()
        if (ativo) setProjetos(dados)
      } catch (e) {
        if (ativo) setErro(e.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarProjetos()

    return () => {
      ativo = false
    }
  }, [])

  function abrirModalNovoProjeto() {
    setTitulo('')
    setDescricao('')
    setArquivoEmenta(null)
    setErroSalvar('')
    setModalAberto(true)
  }

  async function criarProjeto() {
    setSalvando(true)
    setErroSalvar('')
    try {
      const res = await projetosFetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, descricao }),
      })
      if (!res.ok) {
        const corpo = await res.json().catch(() => null)
        throw new Error(corpo?.titulo?.[0] || corpo?.detail || 'Erro ao criar projeto.')
      }
      let criado = await res.json()
      let avisoArquivo = ''
      if (arquivoEmenta) {
        try {
          criado = await enviarEmentaProjeto(criado.id, arquivoEmenta)
        } catch (e) {
          avisoArquivo = e.message
        }
      }
      setProjetos((atuais) => [criado, ...atuais])
      setModalAberto(false)
      if (avisoArquivo) {
        toast({
          message: `Projeto criado, mas a matriz/ementa não foi enviada: ${avisoArquivo}`,
          tone: 'warning',
          duration: 6000,
        })
      } else {
        toast({ message: 'Projeto criado com sucesso.', tone: 'success' })
      }
    } catch (e) {
      setErroSalvar(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Meus projetos"
        description="Clique em um projeto para ver a ementa e gerenciar as bolsas."
        action={
          <Button variant="primary" onClick={abrirModalNovoProjeto}>
            <IconPlus /> Novo projeto
          </Button>
        }
      />

      {erro && <Alert tone="error">{erro}</Alert>}

      {carregando ? (
        <Carregando texto="Carregando projetos..." />
      ) : projetos.length === 0 ? (
        <EmptyState
          icon={<IconFolder />}
          title="Nenhum projeto cadastrado"
          description="Crie um projeto para solicitar bolsas. Não é preciso autorização do administrador."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {projetos.map((projeto) => (
            <ProjetoCard
              key={projeto.id}
              projeto={projeto}
              onClick={() => onGerenciar(projeto.id)}
            />
          ))}
        </div>
      )}

      {modalAberto && (
        <Modal title="Novo Projeto" onClose={() => setModalAberto(false)}>
          {erroSalvar && <Alert tone="error">{erroSalvar}</Alert>}
          <FormField label="Título">
            <TextInput value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          </FormField>
          <FormField label="Descrição">
            <TextArea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </FormField>
          <FormField label="Matriz / ementa (opcional: .pdf, .doc ou .docx, até 10 MB)">
            <FileField
              value={arquivoEmenta?.name || ''}
              onChange={(arquivo) => {
                const erroArquivo = arquivo ? validarArquivoEmenta(arquivo) : ''
                setErroSalvar(erroArquivo)
                setArquivoEmenta(erroArquivo ? null : arquivo)
              }}
              accept=".pdf,.doc,.docx"
              disabled={salvando}
            />
          </FormField>
          <FormActions>
            <Button variant="danger" onClick={() => setModalAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="accent" onClick={criarProjeto} disabled={!titulo} loading={salvando}>
              Criar Projeto
            </Button>
          </FormActions>
        </Modal>
      )}
    </>
  )
}

// ─── detalhe do projeto ─────────────────────────────────────────────────────

const BOLSA_INICIAL = {
  editalId: '',
  tipo: '',
  modalidade: '',
  cargaHorariaSemanal: '',
  quantidadeVagas: '1',
  prerequisitos: '',
  metodologiaAvaliacao: '',
  notaMinima: '',
  dataInicioVigencia: '',
  dataFimVigencia: '',
}

function formDaBolsa(bolsa) {
  return {
    editalId: String(bolsa.edital),
    tipo: bolsa.tipo,
    modalidade: bolsa.modalidade,
    cargaHorariaSemanal: String(bolsa.carga_horaria_semanal),
    quantidadeVagas: String(bolsa.quantidade_vagas),
    prerequisitos: bolsa.prerequisitos || '',
    metodologiaAvaliacao: bolsa.metodologia_avaliacao || '',
    notaMinima: bolsa.nota_minima ?? '',
    dataInicioVigencia: bolsa.data_inicio_vigencia || '',
    dataFimVigencia: bolsa.data_fim_vigencia || '',
  }
}

function mensagemDeErro(corpo, padrao) {
  return (
    corpo?.edital?.[0] ||
    corpo?.projeto?.[0] ||
    corpo?.detail ||
    Object.values(corpo || {})
      .flat()
      .join(' ') ||
    padrao
  )
}

/** Detalhes da bolsa do projeto no painel lateral: valores, regras, etapas e bolsistas. */
function BolsaDrawer({ bolsa, bolsistas, acoes, onAtualizada, onFechar }) {
  // Só a bolsa solicitada (antes da aprovação) é editada; depois, só as etapas.
  const editavelPeloStatus = bolsa.status === 'SOLICITADA'
  const vigencia =
    bolsa.inicio_vigencia && bolsa.fim_vigencia
      ? `${formatarData(bolsa.inicio_vigencia)} – ${formatarData(bolsa.fim_vigencia)}`
      : 'Não definida'

  return (
    <Drawer
      title={`${bolsa.modalidade} · ${bolsa.carga_horaria_semanal}h`}
      subtitle={MODALIDADE_LABEL[bolsa.modalidade] ?? bolsa.modalidade_display}
      width={600}
      onClose={onFechar}
      footer={
        acoes.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2">{acoes}</div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6 p-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={bolsa.status} />
            {bolsa.pode_editar && bolsa.edital_fechamento_inscricoes && (
              <span className="text-xs text-gray-500">
                Editável até o fim das inscrições (
                {formatarData(bolsa.edital_fechamento_inscricoes)})
              </span>
            )}
          </div>
          {editavelPeloStatus && !bolsa.pode_editar && bolsa.motivo_bloqueio_edicao && (
            <p className="text-xs text-gray-500">
              Edição indisponível: {bolsa.motivo_bloqueio_edicao}
            </p>
          )}
        </div>
        {bolsa.status === 'REJEITADA' && bolsa.justificativa_decisao && (
          <Alert tone="error" title="Motivo da rejeição">
            {bolsa.justificativa_decisao}
          </Alert>
        )}
        <dl className="grid grid-cols-2 gap-4">
          <KeyValue label="Valor mensal">{formatarMoeda(bolsa.valor_mensal)}</KeyValue>
          <KeyValue label="Vagas">{bolsa.quantidade_vagas}</KeyValue>
          <KeyValue label="Vigência">{vigencia}</KeyValue>
          <KeyValue label="Nota mínima">
            {bolsa.nota_minima ? Number(bolsa.nota_minima).toFixed(1) : '—'}
          </KeyValue>
          <KeyValue label="Edital">{bolsa.edital_ano_codigo || bolsa.edital_nome}</KeyValue>
          <KeyValue label="Tipo">{bolsa.tipo_display}</KeyValue>
        </dl>
        <div>
          <div className="text-xs text-gray-500">Pré-requisitos</div>
          <p className="mt-0.5 text-sm text-gray-700">{bolsa.prerequisitos || '—'}</p>
        </div>
        <div>
          <div className="text-xs text-gray-500">Metodologia de avaliação</div>
          <p className="mt-0.5 text-sm text-gray-700">{bolsa.metodologia_avaliacao || '—'}</p>
        </div>
        <EtapasEditor bolsa={bolsa} onAtualizada={onAtualizada} />
        <section>
          <p className="mb-2 text-xs font-medium text-gray-500">Bolsistas</p>
          {bolsistas.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum bolsista ainda.</p>
          ) : (
            bolsistas.map((vinculo) => (
              <div key={vinculo.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="flex items-center gap-2">
                  <Avatar initials={iniciais(vinculo.aluno_nome)} size={22} />
                  {vinculo.aluno_nome}
                </span>
                <StatusPill status={vinculo.status} size="sm" />
              </div>
            ))
          )}
        </section>
      </div>
    </Drawer>
  )
}

function ProjetoDetalhe({ projetoId, onVoltar }) {
  const confirmar = useConfirm()
  const toast = useToast()

  const [projeto, setProjeto] = useState(null)
  const [bolsas, setBolsas] = useState([])
  const [editais, setEditais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [modalAberto, setModalAberto] = useState(false)
  const [bolsaEditando, setBolsaEditando] = useState(null) // null = nova solicitação
  const [bolsaConvidar, setBolsaConvidar] = useState(null) // bolsa com o modal de convite aberto
  const [bolsasElegiveisIds, setBolsasElegiveisIds] = useState(new Set())
  const [form, setForm] = useState(BOLSA_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState('')
  const [avisoSemEditais, setAvisoSemEditais] = useState(false)
  // Pendências em qualquer projeto do coordenador que impedem solicitar nova bolsa.
  const [pendencias, setPendencias] = useState([])
  const [vinculos, setVinculos] = useState([])
  const [bolsaAbertaId, setBolsaAbertaId] = useState(null) // bolsa com o painel lateral aberto
  // combinações modalidade + CH (e valores) disponíveis no edital escolhido no formulário
  const [valoresEdital, setValoresEdital] = useState({ editalId: '', itens: [], erro: '' })

  useEffect(() => {
    if (!modalAberto || !form.editalId) return undefined
    let ativo = true

    async function carregarValores() {
      try {
        const res = await editaisFetch(`/${form.editalId}/valores-bolsa/`)
        const dados = await res.json().catch(() => null)
        if (!res.ok || !Array.isArray(dados)) {
          throw new Error(dados?.detail || 'Não foi possível carregar os valores do edital.')
        }
        if (ativo) {
          setValoresEdital({
            editalId: form.editalId,
            itens: dados.filter((item) => item.disponivel),
            erro: '',
          })
        }
      } catch (e) {
        if (ativo) setValoresEdital({ editalId: form.editalId, itens: [], erro: e.message })
      }
    }

    carregarValores()
    return () => {
      ativo = false
    }
  }, [modalAberto, form.editalId])

  useEffect(() => {
    let ativo = true

    async function carregarTudo() {
      try {
        const [resProjeto, resBolsas, resEditais, resElegiveis, resPendencias, resVinculos] =
          await Promise.all([
            projetosFetch(`/${projetoId}/`),
            bolsasFetch('/'),
            editaisFetch('/'),
            vinculoDiretoFetch('/bolsas-elegiveis/'),
            bolsasFetch('/pendencias/'),
            bolsistasFetch('/vinculos/'),
          ])

        if (!resProjeto.ok) throw new Error('Não foi possível carregar o projeto.')

        const dadosProjeto = await resProjeto.json()
        const todasBolsas = resBolsas.ok ? await resBolsas.json() : []
        const todosEditais = resEditais.ok ? await resEditais.json() : []
        const elegiveis = resElegiveis.ok ? await resElegiveis.json() : []
        const dadosPendencias = resPendencias.ok ? await resPendencias.json() : null
        const todosVinculos = resVinculos.ok ? await resVinculos.json() : []

        if (!ativo) return
        setProjeto(dadosProjeto)
        setBolsas(todasBolsas.filter((bolsa) => bolsa.projeto === projetoId))
        setEditais(todosEditais.filter((edital) => edital.status === 'EM_VIGOR'))
        setBolsasElegiveisIds(new Set(elegiveis.map((bolsa) => bolsa.id)))
        setPendencias(dadosPendencias?.pendencias ?? [])
        setVinculos(Array.isArray(todosVinculos) ? todosVinculos : [])
      } catch (e) {
        if (ativo) setErro(e.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarTudo()

    return () => {
      ativo = false
    }
  }, [projetoId])

  function abrirModalSolicitarBolsa() {
    if (editais.length === 0) {
      setAvisoSemEditais(true)
      return
    }
    setAvisoSemEditais(false)
    setBolsaEditando(null)
    setForm(BOLSA_INICIAL)
    setErroSalvar('')
    setModalAberto(true)
  }

  function abrirModalEditarBolsa(bolsa) {
    setBolsaEditando(bolsa)
    setForm(formDaBolsa(bolsa))
    setErroSalvar('')
    setModalAberto(true)
  }

  function atualizarCampo(campo, valor) {
    setForm((atual) => {
      const novo = { ...atual, [campo]: valor }
      // a CH depende da modalidade, e ambas dependem do que o edital oferece
      if (campo === 'editalId') {
        novo.modalidade = ''
        novo.cargaHorariaSemanal = ''
      }
      if (campo === 'modalidade') novo.cargaHorariaSemanal = ''
      return novo
    })
  }

  const valoresCarregados = valoresEdital.editalId === form.editalId
  const combinacoes = valoresCarregados ? valoresEdital.itens : []
  const combinacaoSelecionada = combinacoes.find(
    (item) =>
      item.modalidade === form.modalidade &&
      String(item.carga_horaria_semanal) === form.cargaHorariaSemanal
  )
  // bolsa criada antes da tabela de valores do edital: mantém modalidade, CH e valor gravados
  const combinacaoLegada =
    !combinacaoSelecionada &&
    bolsaEditando &&
    form.modalidade === bolsaEditando.modalidade &&
    form.cargaHorariaSemanal === String(bolsaEditando.carga_horaria_semanal)
  const valorDaBolsa = combinacaoSelecionada
    ? combinacaoSelecionada.valor_mensal
    : combinacaoLegada
      ? bolsaEditando.valor_mensal
      : ''

  const modalidadesDisponiveis = [...new Set(combinacoes.map((item) => item.modalidade))]
  if (bolsaEditando && !modalidadesDisponiveis.includes(bolsaEditando.modalidade)) {
    modalidadesDisponiveis.push(bolsaEditando.modalidade)
  }
  const cargasDisponiveis = combinacoes
    .filter((item) => item.modalidade === form.modalidade)
    .map((item) => String(item.carga_horaria_semanal))
  if (
    bolsaEditando &&
    form.modalidade === bolsaEditando.modalidade &&
    !cargasDisponiveis.includes(String(bolsaEditando.carga_horaria_semanal))
  ) {
    cargasDisponiveis.push(String(bolsaEditando.carga_horaria_semanal))
  }

  const cargasDoEdital = [
    ...new Set([
      ...combinacoes.map((item) => String(item.carga_horaria_semanal)),
      ...cargasDisponiveis,
    ]),
  ].sort((a, b) => Number(a) - Number(b))

  const editalSelecionado = editais.find((edital) => String(edital.id) === String(form.editalId))
  const editalSelecionadoComPrazoEncerrado = !!editalSelecionado?.prazo_inscricao_encerrado
  function dadosDoFormulario() {
    return {
      tipo: form.tipo,
      modalidade: form.modalidade,
      carga_horaria_semanal: Number(form.cargaHorariaSemanal),
      quantidade_vagas: Number(form.quantidadeVagas),
      prerequisitos: form.prerequisitos,
      metodologia_avaliacao: form.metodologiaAvaliacao,
      nota_minima: form.notaMinima !== '' ? Number(form.notaMinima) : null,
      // Vazio: vale a vigência do edital.
      data_inicio_vigencia: form.dataInicioVigencia || null,
      data_fim_vigencia: form.dataFimVigencia || null,
    }
  }

  function salvarBolsa() {
    return bolsaEditando ? editarBolsa() : solicitarBolsa()
  }

  async function editarBolsa() {
    setSalvando(true)
    setErroSalvar('')
    try {
      const res = await bolsasFetch(`/${bolsaEditando.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosDoFormulario()),
      })

      if (!res.ok) {
        const corpo = await res.json().catch(() => null)
        throw new Error(mensagemDeErro(corpo, 'Erro ao salvar a bolsa.'))
      }

      const atualizada = await res.json()
      setBolsas((atuais) => atuais.map((item) => (item.id === atualizada.id ? atualizada : item)))
      setModalAberto(false)
      toast({ message: 'Bolsa atualizada com sucesso.', tone: 'success' })
    } catch (e) {
      setErroSalvar(e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function solicitarBolsa() {
    setSalvando(true)
    setErroSalvar('')
    try {
      const res = await bolsasFetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projeto: projetoId,
          edital: Number(form.editalId),
          ...dadosDoFormulario(),
        }),
      })

      if (!res.ok) {
        const corpo = await res.json().catch(() => null)
        throw new Error(mensagemDeErro(corpo, 'Erro ao solicitar bolsa.'))
      }

      const criada = await res.json()
      setBolsas((atuais) => [criada, ...atuais])
      setModalAberto(false)
      toast({ message: 'Bolsa solicitada com sucesso.', tone: 'success' })
    } catch (e) {
      setErroSalvar(e.message)
    } finally {
      setSalvando(false)
    }
  }

  function confirmarDesligar(projeto) {
    confirmar({
      title: 'Desligar projeto',
      message:
        'Tem certeza que deseja desligar este projeto? Só é possível reverter criando um novo projeto.',
      confirmLabel: 'Desligar Projeto',
      tone: 'danger',
      onConfirm: async () => {
        const res = await projetosFetch(`/${projeto.id}/desligar/`, { method: 'POST' })
        if (res.ok) {
          setProjeto(await res.json())
          toast({ message: 'Projeto desligado com sucesso.', tone: 'success' })
        } else {
          const corpo = await res.json().catch(() => null)
          const statusBloqueantes = corpo?.status_bloqueantes || []

          toast({
            message:
              statusBloqueantes.length > 0 ? (
                <span>
                  Não é possível desligar: o projeto possui bolsa(s) com status{' '}
                  {statusBloqueantes.map((s) => (
                    <Badge key={s} status={s} />
                  ))}
                  .
                </span>
              ) : (
                corpo?.detail || corpo?.non_field_errors?.[0] || 'Erro ao desligar projeto.'
              ),
            tone: 'error',
            duration: 6000,
          })
        }
      },
    })
  }

  function confirmarCancelarBolsa(bolsa) {
    confirmar({
      title: 'Cancelar bolsa',
      message: 'Cancelar a bolsa encerra o processo. Esta ação não pode ser desfeita.',
      confirmLabel: 'Cancelar Bolsa',
      tone: 'danger',
      onConfirm: async () => {
        const res = await bolsasFetch(`/${bolsa.id}/cancelar/`, { method: 'POST' })
        if (res.ok) {
          const atualizada = await res.json()
          setBolsas((atuais) =>
            atuais.map((item) => (item.id === atualizada.id ? atualizada : item))
          )
          toast({ message: 'Bolsa cancelada com sucesso.', tone: 'success' })
          // Bolsa cancelada não aceita mais convite.
          setBolsasElegiveisIds((atuais) => {
            const copia = new Set(atuais)
            copia.delete(atualizada.id)
            return copia
          })
          // Cancelar uma bolsa vencida pode resolver uma pendência.
          const resPendencias = await bolsasFetch('/pendencias/')
          if (resPendencias.ok) setPendencias((await resPendencias.json()).pendencias)
        } else {
          const corpo = await res.json().catch(() => null)
          toast({ message: corpo?.detail || 'Erro ao cancelar bolsa.', tone: 'error' })
        }
      },
    })
  }

  if (carregando) return <Carregando texto="Carregando projeto..." />

  if (erro || !projeto) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={onVoltar}>
          <IconArrowLeft /> Voltar
        </Button>
        <Alert tone="error">{erro || 'Projeto não encontrado.'}</Alert>
      </>
    )
  }

  const podeCancelar = (bolsa) => !['CANCELADA', 'REJEITADA', 'ENCERRADA'].includes(bolsa.status)

  function acoesDaBolsa(bolsa) {
    return [
      podeCancelar(bolsa) && (
        <Button key="cancelar" variant="ghost" onClick={() => confirmarCancelarBolsa(bolsa)}>
          Cancelar bolsa
        </Button>
      ),
      bolsasElegiveisIds.has(bolsa.id) && (
        <Button key="convidar" onClick={() => setBolsaConvidar(bolsa)}>
          Convidar bolsista
        </Button>
      ),
      bolsa.status === 'SOLICITADA' && (
        <Button
          key="editar"
          variant="primary"
          disabled={!bolsa.pode_editar}
          title={bolsa.motivo_bloqueio_edicao || undefined}
          onClick={() => abrirModalEditarBolsa(bolsa)}
        >
          Editar bolsa
        </Button>
      ),
    ].filter(Boolean)
  }

  function atualizarBolsa(atualizada) {
    setBolsas((atuais) => atuais.map((item) => (item.id === atualizada.id ? atualizada : item)))
  }

  const bolsistasDa = (bolsa) => vinculos.filter((vinculo) => vinculo.bolsa_id === bolsa.id)
  const ativosDa = (bolsa) => bolsistasDa(bolsa).filter((vinculo) => vinculo.status === 'ATIVO')
  const bolsaAberta = bolsas.find((bolsa) => bolsa.id === bolsaAbertaId)
  const investimentoMensal = bolsas
    .filter((bolsa) => bolsa.status === 'PREENCHIDA')
    .reduce((soma, bolsa) => soma + Number(bolsa.valor_mensal), 0)

  return (
    <>
      <button
        type="button"
        onClick={onVoltar}
        className="mb-4 flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-sm text-gray-500 hover:text-gray-900"
      >
        <IconArrowLeft size={14} /> Meus projetos
      </button>

      <PageHeader
        title={projeto.titulo}
        badge={<StatusPill status={projeto.status} />}
        description={projeto.descricao || undefined}
        action={
          projeto.status === 'ATIVO' && (
            <Button variant="outline" onClick={() => confirmarDesligar(projeto)}>
              Desligar projeto
            </Button>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <EmentaProjetoCard projeto={projeto} onAtualizado={setProjeto} className="lg:col-span-3" />
        <Card className="lg:col-span-2">
          <SectionTitle title="Resumo" />
          <dl className="grid grid-cols-2 gap-4">
            <KeyValue label="Área">{(projeto.tipos_bolsa ?? []).join(', ') || '—'}</KeyValue>
            <KeyValue label="Bolsas">{bolsas.length}</KeyValue>
            <KeyValue label="Bolsistas ativos">{projeto.bolsistas_ativos ?? 0}</KeyValue>
            <KeyValue label="Investimento mensal">{formatarMoeda(investimentoMensal)}</KeyValue>
          </dl>
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle
          title="Bolsas do projeto"
          description="Clique em uma bolsa para ver detalhes, etapas e bolsistas."
          action={
            <Button
              variant="primary"
              onClick={abrirModalSolicitarBolsa}
              disabled={pendencias.length > 0}
            >
              <IconPlus /> Solicitar bolsa
            </Button>
          }
        />
      </div>

      {pendencias.length > 0 && (
        <Alert tone="warning" title="Resolva as pendências para solicitar uma nova bolsa">
          <p>Estas pendências estão em aberto nos seus projetos (veja a aba Finalização):</p>
          <ul className="mt-1 list-disc pl-5">
            {pendencias.map((pendencia) => (
              <li key={pendencia}>{pendencia}</li>
            ))}
          </ul>
        </Alert>
      )}

      {avisoSemEditais && (
        <Alert tone="warning">
          Não há editais em vigor no momento, não é possível solicitar uma nova bolsa até que um
          edital seja publicado.
        </Alert>
      )}

      {bolsas.length === 0 ? (
        <EmptyState
          icon={<IconBolsa />}
          title="Nenhuma bolsa ainda"
          description="Solicite uma bolsa para abrir vagas neste projeto."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bolsas.map((bolsa) => (
            <BolsaCard
              key={bolsa.id}
              bolsa={bolsa}
              onClick={() => setBolsaAbertaId(bolsa.id)}
              meta={
                <span className="text-xs text-gray-500 tabular-nums">
                  {ativosDa(bolsa).length}/{bolsa.quantidade_vagas} ocupadas
                </span>
              }
              footer={
                bolsa.status === 'REJEITADA' ? (
                  <p className="line-clamp-2 text-xs text-red-600">{bolsa.justificativa_decisao}</p>
                ) : bolsa.status === 'SOLICITADA' ? (
                  <span className="text-xs text-gray-500">
                    Aguardando aprovação · etapas liberadas depois
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    {bolsa.etapas.length} {bolsa.etapas.length === 1 ? 'etapa' : 'etapas'} de
                    avaliação
                    {bolsa.aviso_pesos && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <IconAlertTriangle size={12} /> pesos não fecham 100%
                      </span>
                    )}
                  </span>
                )
              }
            />
          ))}
        </div>
      )}

      {bolsaAberta && !modalAberto && (
        <BolsaDrawer
          bolsa={bolsaAberta}
          bolsistas={bolsistasDa(bolsaAberta)}
          acoes={acoesDaBolsa(bolsaAberta)}
          onAtualizada={atualizarBolsa}
          onFechar={() => setBolsaAbertaId(null)}
        />
      )}

      {bolsaConvidar && (
        <ConvidarBolsistaModal
          bolsa={bolsaConvidar}
          onFechar={() => setBolsaConvidar(null)}
          onCriado={() => {
            setBolsasElegiveisIds((atuais) => {
              const copia = new Set(atuais)
              copia.delete(bolsaConvidar.id)
              return copia
            })
            setBolsaConvidar(null)
            toast({ message: 'Convite enviado ao aluno.', tone: 'success' })
          }}
        />
      )}

      {modalAberto && (
        <Modal
          title={bolsaEditando ? 'Editar bolsa' : 'Solicitar bolsa'}
          description={projeto.titulo}
          onClose={() => setModalAberto(false)}
          width={560}
        >
          {bolsaEditando?.status === 'SOLICITADA' && (
            <Alert tone="info">
              A bolsa ainda aguarda a coordenação de área. As alterações aparecem para ela na
              análise.
            </Alert>
          )}
          {erroSalvar && <Alert tone="error">{erroSalvar}</Alert>}

          <FormField
            label="Edital"
            hint={
              bolsaEditando ? 'O edital não pode ser alterado depois da solicitação.' : undefined
            }
          >
            {bolsaEditando ? (
              <Select value="" disabled>
                <option value="">
                  {bolsaEditando.edital_ano_codigo} · {bolsaEditando.edital_nome}
                </option>
              </Select>
            ) : (
              <Select
                value={form.editalId}
                onChange={(e) => atualizarCampo('editalId', e.target.value)}
                required
              >
                <option value="">Selecione um edital</option>
                {editais.map((edital) => (
                  <option key={edital.id} value={edital.id}>
                    {edital.ano_codigo} · {edital.nome}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          {editalSelecionadoComPrazoEncerrado && (
            <Alert tone="warning">
              O prazo de inscrição deste edital já foi encerrado. A bolsa pode ser solicitada e
              aprovada normalmente, mas não vai ficar disponível para inscrição dos alunos.
            </Alert>
          )}

          <FormField label="Tipo da bolsa" hint="Define a coordenação de área que analisa a bolsa.">
            <Select
              value={form.tipo}
              onChange={(e) => atualizarCampo('tipo', e.target.value)}
              required
            >
              <option value="">Selecione o tipo</option>
              {TIPO_OPTIONS.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </Select>
          </FormField>

          {valoresEdital.erro && valoresCarregados && (
            <Alert tone="error">{valoresEdital.erro}</Alert>
          )}
          {form.editalId &&
            valoresCarregados &&
            !valoresEdital.erro &&
            combinacoes.length === 0 &&
            !bolsaEditando && (
              <Alert tone="warning">
                Este edital ainda não tem modalidades e valores de bolsa definidos pela coordenação
                de área. Não é possível solicitar bolsa nele por enquanto.
              </Alert>
            )}

          <FormField label="Modalidade">
            <div className="grid grid-cols-3 gap-2">
              {Object.keys(MODALIDADE_LABEL).map((modalidade) => {
                const ofertada = modalidadesDisponiveis.includes(modalidade)
                const escolhida = form.modalidade === modalidade
                return (
                  <button
                    key={modalidade}
                    type="button"
                    disabled={!ofertada}
                    onClick={() => atualizarCampo('modalidade', modalidade)}
                    className={`cursor-pointer rounded-lg border bg-white px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
                      escolhida
                        ? 'border-gray-900 ring-1 ring-gray-900'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-gray-900">{modalidade}</span>
                    <span className="block truncate text-2xs text-gray-500">
                      {MODALIDADE_LABEL[modalidade]}
                    </span>
                  </button>
                )
              })}
            </div>
          </FormField>

          <FormField label="Carga horária semanal">
            <div className="inline-flex self-start rounded-lg border border-gray-200 bg-white p-0.5">
              {(cargasDoEdital.length ? cargasDoEdital : ['8', '12', '16']).map((carga) => {
                const ofertada = cargasDisponiveis.includes(carga)
                return (
                  <button
                    key={carga}
                    type="button"
                    disabled={!ofertada}
                    onClick={() => atualizarCampo('cargaHorariaSemanal', carga)}
                    className={`cursor-pointer rounded-md border-0 px-4 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:bg-transparent disabled:text-gray-300 ${
                      form.cargaHorariaSemanal === carga
                        ? 'bg-gray-900 text-white'
                        : 'bg-transparent text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {carga}h
                  </button>
                )
              })}
            </div>
          </FormField>

          <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
            <span className="text-gray-500">Valor mensal definido no edital</span>
            <span className="font-semibold text-gray-900 tabular-nums">
              {valorDaBolsa
                ? formatarMoeda(valorDaBolsa)
                : form.modalidade && form.cargaHorariaSemanal
                  ? 'Combinação não ofertada'
                  : '—'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4">
            <FormField label="Vagas">
              <TextInput
                type="number"
                step="1"
                min="1"
                value={form.quantidadeVagas}
                onChange={(e) => atualizarCampo('quantidadeVagas', e.target.value)}
                required
              />
            </FormField>
            <FormField label="Nota mínima" hint="Opcional">
              <TextInput
                type="number"
                step="0.5"
                min="0"
                max="10"
                value={form.notaMinima}
                onChange={(e) => atualizarCampo('notaMinima', e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-x-4">
            <FormField label="Início da vigência" hint="Vazio: vale a do edital.">
              <TextInput
                type="date"
                value={form.dataInicioVigencia}
                onChange={(e) => atualizarCampo('dataInicioVigencia', e.target.value)}
              />
            </FormField>
            <FormField label="Fim da vigência" hint="Vazio: vale a do edital.">
              <TextInput
                type="date"
                value={form.dataFimVigencia}
                onChange={(e) => atualizarCampo('dataFimVigencia', e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Pré-requisitos">
            <TextArea
              rows={2}
              value={form.prerequisitos}
              onChange={(e) => atualizarCampo('prerequisitos', e.target.value)}
            />
          </FormField>

          <FormField
            label="Metodologia de avaliação"
            hint="As etapas e os pesos são definidos na bolsa depois da aprovação."
          >
            <TextArea
              rows={2}
              value={form.metodologiaAvaliacao}
              onChange={(e) => atualizarCampo('metodologiaAvaliacao', e.target.value)}
            />
          </FormField>

          <FormActions>
            <Button onClick={() => setModalAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={salvarBolsa}
              loading={salvando}
              disabled={
                !form.editalId ||
                !form.tipo ||
                !form.modalidade ||
                !form.cargaHorariaSemanal ||
                !valorDaBolsa ||
                !Number.isInteger(Number(form.quantidadeVagas)) ||
                Number(form.quantidadeVagas) < 1
              }
            >
              {bolsaEditando ? 'Salvar alterações' : 'Enviar solicitação'}
            </Button>
          </FormActions>
        </Modal>
      )}
    </>
  )
}
