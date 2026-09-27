import { useEffect, useState } from 'react'
import { editaisFetch, projetosFetch, bolsasFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  Button,
  DataTable,
  FileField,
  FormActions,
  FormField,
  IconArrowLeft,
  IconPlus,
  Modal,
  PageHeader,
  Select,
  TextArea,
  TextInput,
  useConfirm,
  useToast,
} from '../components'
import { enviarEmentaProjeto, validarArquivoEmenta } from '../utils/ementaProjeto'
import EmentaProjetoCard from './EmentaProjetoCard'
import EtapasAvaliacaoModal from './EtapasAvaliacaoModal'

// Status em que as etapas de avaliação aparecem (antes de aprovada não faz sentido;
// encerrada/cancelada/rejeitada não tem mais o que ver).
const STATUS_COM_ETAPAS = ['APROVADA', 'ABERTA', 'EM_SELECAO', 'PREENCHIDA']

const TIPO_OPTIONS = [
  { value: 'ENSINO', label: 'Ensino' },
  { value: 'PESQUISA', label: 'Pesquisa' },
  { value: 'EXTENSAO', label: 'Extensão' },
  { value: 'INDISSOCIAVEL', label: 'Indissociável' },
]

const MODALIDADE_OPTIONS = [
  { value: 'BICT', label: 'Bolsa de Iniciação Científica (BICT)' },
  { value: 'BIDTI', label: 'Bolsa de Iniciação ao Desenv. Tecnológico e Inovação (BIDTI)' },
  { value: 'BAT', label: 'Bolsa de Apoio Técnico (BAT)' },
]

const CARGA_HORARIA_OPTIONS = [
  { value: '8', label: '8h semanais' },
  { value: '12', label: '12h semanais' },
  { value: '16', label: '16h semanais' },
]

function opcaoLabel(opcoes, valor) {
  return opcoes.find((opcao) => opcao.value === valor)?.label || valor
}

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

function ListaProjetos({ onGerenciar }) {
  const confirmar = useConfirm()
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
          const atualizado = await res.json()
          setProjetos((atuais) =>
            atuais.map((item) => (item.id === atualizado.id ? atualizado : item))
          )
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

  const linhas = projetos.map((projeto) => [
    projeto.titulo,
    <Badge key="status" status={projeto.status} />,
    <AcoesCell
      key="acoes"
      mostrar={projeto.status === 'ATIVO'}
      acoes={[
        { label: 'Gerenciar', onClick: () => onGerenciar(projeto.id) },
        { label: 'Desligar', variant: 'danger', onClick: () => confirmarDesligar(projeto) },
      ]}
    />,
  ])

  return (
    <>
      <PageHeader
        title="Meus Projetos"
        action={
          <Button variant="accent" onClick={abrirModalNovoProjeto}>
            <IconPlus /> Novo Projeto
          </Button>
        }
      />
      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: -8, marginBottom: 16 }}>
        Projetos são criados livremente por você. Não é necessária autorização do Administrador.
      </p>

      {erro && <Alert tone="error">{erro}</Alert>}

      {carregando ? (
        <p role="status">Carregando projetos...</p>
      ) : (
        <DataTable
          columns={['Título', 'Status', 'Ações']}
          rows={linhas}
          emptyMessage="Nenhum projeto cadastrado."
        />
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
            <Button variant="outline" onClick={() => setModalAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="accent" onClick={criarProjeto} disabled={salvando || !titulo}>
              {salvando ? 'Criando...' : 'Criar Projeto'}
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
  valorMensal: '',
  quantidadeVagas: '1',
  prerequisitos: '',
  metodologiaAvaliacao: '',
  notaMinima: '',
}

function formDaBolsa(bolsa) {
  return {
    editalId: String(bolsa.edital),
    tipo: bolsa.tipo,
    modalidade: bolsa.modalidade,
    cargaHorariaSemanal: String(bolsa.carga_horaria_semanal),
    valorMensal: bolsa.valor_mensal,
    quantidadeVagas: String(bolsa.quantidade_vagas),
    prerequisitos: bolsa.prerequisitos || '',
    metodologiaAvaliacao: bolsa.metodologia_avaliacao || '',
    notaMinima: bolsa.nota_minima ?? '',
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
  const [bolsaEtapas, setBolsaEtapas] = useState(null) // bolsa com o modal de etapas aberto
  const [form, setForm] = useState(BOLSA_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState('')
  const [avisoSemEditais, setAvisoSemEditais] = useState(false)

  useEffect(() => {
    let ativo = true

    async function carregarTudo() {
      try {
        const [resProjeto, resBolsas, resEditais] = await Promise.all([
          projetosFetch(`/${projetoId}/`),
          bolsasFetch('/'),
          editaisFetch('/'),
        ])

        if (!resProjeto.ok) throw new Error('Não foi possível carregar o projeto.')

        const dadosProjeto = await resProjeto.json()
        const todasBolsas = resBolsas.ok ? await resBolsas.json() : []
        const todosEditais = resEditais.ok ? await resEditais.json() : []

        if (!ativo) return
        setProjeto(dadosProjeto)
        setBolsas(todasBolsas.filter((bolsa) => bolsa.projeto === projetoId))
        setEditais(todosEditais.filter((edital) => edital.status === 'EM_VIGOR'))
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
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function dadosDoFormulario() {
    return {
      tipo: form.tipo,
      modalidade: form.modalidade,
      carga_horaria_semanal: Number(form.cargaHorariaSemanal),
      valor_mensal: form.valorMensal,
      quantidade_vagas: Number(form.quantidadeVagas),
      prerequisitos: form.prerequisitos,
      metodologia_avaliacao: form.metodologiaAvaliacao,
      nota_minima: form.notaMinima !== '' ? Number(form.notaMinima) : null,
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
        } else {
          const corpo = await res.json().catch(() => null)
          toast({ message: corpo?.detail || 'Erro ao cancelar bolsa.', tone: 'error' })
        }
      },
    })
  }

  if (carregando) return <p role="status">Carregando projeto...</p>

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

  const tipoBloqueado = !!bolsaEditando && bolsaEditando.status !== 'SOLICITADA'

  const podeCancelar = (bolsa) => !['CANCELADA', 'REJEITADA', 'ENCERRADA'].includes(bolsa.status)

  const linhasBolsas = bolsas.map((bolsa) => [
    bolsa.edital_nome,
    opcaoLabel(TIPO_OPTIONS, bolsa.tipo),
    opcaoLabel(MODALIDADE_OPTIONS, bolsa.modalidade),
    bolsa.quantidade_vagas,
    `R$ ${bolsa.valor_mensal}`,
    <Badge key="status" status={bolsa.status} />,
    <AcoesCell
      key="acoes"
      acoes={[
        ...(STATUS_COM_ETAPAS.includes(bolsa.status)
          ? [
              {
                label: 'Etapas de avaliação',
                variant: 'outline',
                onClick: () => setBolsaEtapas(bolsa),
              },
            ]
          : []),
        ...(bolsa.pode_editar
          ? [{ label: 'Editar', variant: 'outline', onClick: () => abrirModalEditarBolsa(bolsa) }]
          : []),
        ...(podeCancelar(bolsa)
          ? [
              {
                label: 'Cancelar Bolsa',
                variant: 'danger',
                onClick: () => confirmarCancelarBolsa(bolsa),
              },
            ]
          : []),
      ]}
    />,
  ])

  return (
    <>
      <Button variant="outline" size="sm" onClick={onVoltar}>
        <IconArrowLeft /> Voltar
      </Button>

      <PageHeader title={projeto.titulo} badge={<Badge status={projeto.status} />} />
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
        }}
      >
        {projeto.descricao || 'Sem descrição.'}
      </div>

      <EmentaProjetoCard projeto={projeto} onAtualizado={setProjeto} />

      <PageHeader
        title="Bolsas do Projeto"
        action={
          <Button variant="accent" onClick={abrirModalSolicitarBolsa}>
            <IconPlus /> Solicitar Bolsa
          </Button>
        }
      />

      {avisoSemEditais && (
        <Alert tone="warning">
          Não há editais em vigor no momento — não é possível solicitar uma nova bolsa até que um
          edital seja publicado.
        </Alert>
      )}

      <DataTable
        columns={['Edital', 'Tipo', 'Modalidade', 'Vagas', 'Valor', 'Status', 'Ações']}
        rows={linhasBolsas}
        emptyMessage="Nenhuma bolsa solicitada para este projeto."
      />

      {bolsaEtapas && (
        <EtapasAvaliacaoModal
          bolsa={bolsaEtapas}
          onFechar={() => setBolsaEtapas(null)}
          onAtualizada={(atualizada) =>
            setBolsas((atuais) =>
              atuais.map((item) => (item.id === atualizada.id ? atualizada : item))
            )
          }
        />
      )}

      {modalAberto && (
        <Modal
          title={bolsaEditando ? 'Editar Bolsa' : 'Solicitar Nova Bolsa'}
          onClose={() => setModalAberto(false)}
          width={600}
        >
          {erroSalvar && <Alert tone="error">{erroSalvar}</Alert>}

          <FormField label={bolsaEditando ? 'Edital (não pode ser alterado)' : 'Edital'}>
            {bolsaEditando ? (
              <TextInput value={bolsaEditando.edital_nome} disabled />
            ) : (
              <Select
                value={form.editalId}
                onChange={(e) => atualizarCampo('editalId', e.target.value)}
                required
              >
                <option value="">Selecione um edital</option>
                {editais.map((edital) => (
                  <option key={edital.id} value={edital.id}>
                    {edital.nome} ({edital.ano_codigo})
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField
            label={
              tipoBloqueado
                ? 'Tipo da bolsa (não pode ser alterado depois da aprovação)'
                : 'Tipo da bolsa (define o Coordenador de Área responsável)'
            }
          >
            <Select
              value={form.tipo}
              onChange={(e) => atualizarCampo('tipo', e.target.value)}
              disabled={tipoBloqueado}
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

          <FormField label="Modalidade">
            <Select
              value={form.modalidade}
              onChange={(e) => atualizarCampo('modalidade', e.target.value)}
              required
            >
              <option value="">Selecione a modalidade</option>
              {MODALIDADE_OPTIONS.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Carga horária semanal">
            <Select
              value={form.cargaHorariaSemanal}
              onChange={(e) => atualizarCampo('cargaHorariaSemanal', e.target.value)}
              required
            >
              <option value="">Selecione a CH</option>
              {CARGA_HORARIA_OPTIONS.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Valor mensal (R$)">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={form.valorMensal}
              onChange={(e) => atualizarCampo('valorMensal', e.target.value)}
              required
            />
          </FormField>

          <FormField label="Quantidade de vagas">
            <TextInput
              type="number"
              step="1"
              min="1"
              value={form.quantidadeVagas}
              onChange={(e) => atualizarCampo('quantidadeVagas', e.target.value)}
              required
            />
          </FormField>

          <FormField label="Nota mínima de classificação (opcional)">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={form.notaMinima}
              onChange={(e) => atualizarCampo('notaMinima', e.target.value)}
            />
          </FormField>

          <FormField label="Pré-requisitos">
            <TextArea
              rows={2}
              value={form.prerequisitos}
              onChange={(e) => atualizarCampo('prerequisitos', e.target.value)}
            />
          </FormField>

          <FormField label="Metodologia de avaliação">
            <TextArea
              rows={2}
              value={form.metodologiaAvaliacao}
              onChange={(e) => atualizarCampo('metodologiaAvaliacao', e.target.value)}
            />
          </FormField>

          <FormActions>
            <Button variant="outline" onClick={() => setModalAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              variant="accent"
              onClick={salvarBolsa}
              disabled={
                salvando ||
                !form.editalId ||
                !form.tipo ||
                !form.modalidade ||
                !form.cargaHorariaSemanal ||
                !form.valorMensal ||
                !Number.isInteger(Number(form.quantidadeVagas)) ||
                Number(form.quantidadeVagas) < 1
              }
            >
              {salvando ? 'Enviando...' : bolsaEditando ? 'Salvar Alterações' : 'Solicitar Bolsa'}
            </Button>
          </FormActions>
        </Modal>
      )}
    </>
  )
}
