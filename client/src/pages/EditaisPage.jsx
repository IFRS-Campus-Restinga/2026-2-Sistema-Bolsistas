import { useEffect, useState } from 'react'
import { editaisFetch } from '../api'
import {
  AcoesCell,
  Badge,
  Button,
  DataTable,
  Modal,
  PageHeader,
  useConfirm,
  useToast,
} from '../components'
import EditalForm from './EditalForm'

function formatarData(iso) {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarDataHora(iso) {
  if (!iso) return '—'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(data)
}

const DATAS_CHAVE = [
  ['Abertura', 'data_abertura_inscricoes'],
  ['Fechamento', 'data_fechamento_inscricoes'],
  ['Homologação', 'data_homologacao'],
  ['Início recursos', 'data_recurso_homologacao_inicio'],
  ['Fim recursos', 'data_recurso_homologacao_fim'],
  ['Resultado', 'data_resultado'],
  ['Preenchimento vagas', 'data_maxima_preenchimento_vagas'],
  ['Entrega relatórios', 'data_entrega_relatorios'],
]

export default function EditaisPage() {
  const toast = useToast()
  const [editais, setEditais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [editalEdicao, setEditalEdicao] = useState(null)
  const [processando, setProcessando] = useState(false)
  const [editalHistorico, setEditalHistorico] = useState(null)
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const confirmar = useConfirm()

  useEffect(() => {
    let ativo = true

    async function carregarEditais() {
      try {
        const response = await editaisFetch()
        const dados = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(dados?.detail || 'Não foi possível carregar os editais.')
        }

        if (!Array.isArray(dados)) {
          throw new Error('A API retornou uma lista de editais inválida.')
        }

        if (ativo) setEditais(dados)
      } catch (error) {
        if (ativo) setErro(error.message || 'Falha ao conectar ao servidor.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarEditais()

    return () => {
      ativo = false
    }
  }, [])

  function atualizarLista(edital) {
    setEditais((atuais) => {
      const existe = atuais.some((item) => item.id === edital.id)
      return existe
        ? atuais.map((item) => (item.id === edital.id ? edital : item))
        : [edital, ...atuais]
    })
  }

  function concluirCadastro(edital) {
    atualizarLista(edital)
    setMostrarFormulario(false)
    setEditalEdicao(null)
    toast({ message: 'Edital salvo com sucesso.', tone: 'success' })
  }

  async function abrirEdicao(edital) {
    setProcessando(true)
    try {
      const response = await editaisFetch(`/${edital.id}/`)
      const dados = await response.json().catch(() => null)
      if (!response.ok || !dados) {
        throw new Error(dados?.detail || 'Não foi possível carregar o edital.')
      }
      setEditalEdicao(dados)
      setMostrarFormulario(true)
    } catch (error) {
      setErro(error.message || 'Falha ao conectar ao servidor.')
      toast({ message: error.message || 'Falha ao conectar ao servidor.', tone: 'error' })
    } finally {
      setProcessando(false)
    }
  }

  async function alterarStatus(edital, acao) {
    setProcessando(true)
    try {
      const response = await editaisFetch(`/${edital.id}/${acao}/`, { method: 'POST' })
      const dados = await response.json().catch(() => null)

      if (!response.ok) {
        let mensagem = dados?.detail || 'Não foi possível alterar o status.'
        if (acao === 'publicar' && response.status === 400 && !dados?.detail) {
          const mensagens = Object.values(dados || {}).flat()
          const camposIncompletos = mensagens.some(
            (texto) => typeof texto === 'string' && texto.includes('obrigatória')
          )
          mensagem = camposIncompletos
            ? 'Para publicar o edital, preencha todos os campos, incluindo as datas do cronograma. Clique em Editar para completar.'
            : 'Para publicar o edital, corrija a ordem das datas do cronograma. Clique em Editar para revisar.'
        }
        throw new Error(mensagem)
      }

      atualizarLista(dados)
      toast({
        message:
          acao === 'publicar' ? 'Edital publicado com sucesso.' : 'Edital encerrado com sucesso.',
        tone: 'success',
      })
    } catch (error) {
      setErro(error.message || 'Falha ao conectar ao servidor.')
      toast({ message: error.message || 'Falha ao conectar ao servidor.', tone: 'error' })
    } finally {
      setProcessando(false)
    }
  }

  async function abrirHistorico(edital) {
    setEditalHistorico(edital)
    setCarregandoHistorico(true)

    try {
      const response = await editaisFetch(`/${edital.id}/`)
      const dados = await response.json().catch(() => null)
      if (!response.ok || !dados) {
        throw new Error(dados?.detail || 'Erro ao carregar histórico de prazos.')
      }
      setEditalHistorico(dados)
    } catch (error) {
      toast({ message: error.message || 'Erro ao carregar histórico de prazos.', tone: 'error' })
    } finally {
      setCarregandoHistorico(false)
    }
  }

  function confirmarStatus(edital) {
    const publicar = edital.status === 'RASCUNHO'
    confirmar({
      title: publicar ? 'Publicar edital?' : 'Encerrar edital?',
      message: publicar ? (
        <>
          O edital será publicado e passará para <Badge status="EM_VIGOR" />.
        </>
      ) : (
        'Após encerrar, o edital não poderá mais ser editado.'
      ),
      confirmLabel: publicar ? 'Publicar' : 'Encerrar',
      tone: publicar ? 'accent' : 'danger',
      onConfirm: () => alterarStatus(edital, publicar ? 'publicar' : 'encerrar'),
    })
  }

  const linhasHistorico = DATAS_CHAVE.flatMap(([rotulo, campo]) => {
    const alteracoes = editalHistorico?.historico_por_data?.[campo] || []

    if (alteracoes.length === 0) {
      return [
        [
          rotulo,
          '—',
          editalHistorico?.[campo] ? formatarData(editalHistorico[campo]) : '—',
          '—',
          '—',
        ],
      ]
    }

    return alteracoes.map((item, indice) => {
      const ehUltima = indice === alteracoes.length - 1
      return [
        rotulo,
        <span
          key={`${campo}-anterior-${indice}`}
          style={{
            textDecoration: item.data_anterior ? 'line-through' : 'none',
            opacity: item.data_anterior ? 0.65 : 1,
          }}
        >
          {formatarData(item.data_anterior)}
        </span>,
        <span
          key={`${campo}-nova-${indice}`}
          style={{
            textDecoration: item.data_nova && !ehUltima ? 'line-through' : 'none',
            opacity: item.data_nova && !ehUltima ? 0.65 : 1,
            fontWeight: item.data_nova && ehUltima ? 600 : 400,
          }}
        >
          {formatarData(item.data_nova)}
        </span>,
        item.responsavel || '—',
        formatarDataHora(item.alterado_em),
      ]
    })
  })

  const linhas = editais.map((edital) => [
    edital.nome,
    edital.ano_codigo,
    <Badge key={`status-${edital.id}`} status={edital.status} />,
    <a
      key={`documento-${edital.id}`}
      href={edital.link_documento_oficial}
      target="_blank"
      rel="noopener noreferrer"
    >
      Documento
    </a>,
    <AcoesCell
      key={`acoes-${edital.id}`}
      mostrar={['RASCUNHO', 'EM_VIGOR', 'ENCERRADO'].includes(edital.status)}
      acoes={[
        {
          label: 'Editar',
          disabled: processando || mostrarFormulario,
          onClick: () => abrirEdicao(edital),
          hidden: edital.status === 'ENCERRADO',
        },
        {
          label: edital.status === 'RASCUNHO' ? 'Publicar' : 'Encerrar',
          variant: edital.status === 'RASCUNHO' ? 'accent' : 'danger',
          disabled: processando || mostrarFormulario,
          onClick: () => confirmarStatus(edital),
          hidden: edital.status === 'ENCERRADO',
        },
        {
          label: 'Histórico de prazos',
          onClick: () => abrirHistorico(edital),
        },
      ].filter((acao) => !acao.hidden)}
    />,
  ])

  return (
    <>
      <PageHeader
        title="Editais"
        action={
          !carregando && (
            <Button
              variant="accent"
              disabled={processando || mostrarFormulario}
              onClick={() => {
                setErro('')
                setEditalEdicao(null)
                setMostrarFormulario(true)
              }}
            >
              Novo edital
            </Button>
          )
        }
      />

      {processando && <p role="status">Processando...</p>}

      {carregando ? (
        <p role="status">Carregando editais...</p>
      ) : (
        <DataTable
          columns={['Nome', 'Ano-Código', 'Status', 'Documento', 'Ações']}
          rows={linhas}
          emptyMessage={erro ? 'Lista indisponível ou vazia.' : 'Nenhum edital cadastrado.'}
        />
      )}

      {mostrarFormulario && (
        <EditalForm
          key={editalEdicao?.id ?? 'novo'}
          edital={editalEdicao}
          onSalvar={concluirCadastro}
          onCancelar={() => {
            setMostrarFormulario(false)
            setEditalEdicao(null)
          }}
        />
      )}

      {editalHistorico && (
        <Modal
          title={`Histórico de prazos: ${editalHistorico.ano_codigo}`}
          onClose={() => {
            setEditalHistorico(null)
          }}
          width={900}
        >
          <DataTable
            columns={['Prazo', 'Data anterior', 'Data atual', 'Alterado por', 'Quando']}
            rows={linhasHistorico}
            loading={carregandoHistorico}
            emptyMessage="Sem dados de cronograma para este edital."
          />
        </Modal>
      )}
    </>
  )
}
