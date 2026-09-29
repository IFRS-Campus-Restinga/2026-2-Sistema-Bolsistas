import { useEffect, useState } from 'react'
import { editaisFetch, getHistoricoCronograma } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  Button,
  DataTable,
  IconArrowLeft,
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

const COLUNAS_HISTORICO = ['Prazo', 'Data anterior', 'Nova data', 'Alterado por', 'Quando']

export default function EditaisPage() {
  const [editais, setEditais] = useState([])
  const [historicoPorEdital, setHistoricoPorEdital] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [editalEdicao, setEditalEdicao] = useState(null)
  const [processando, setProcessando] = useState(false)
  const [editalHistorico, setEditalHistorico] = useState(null)
  const [historico, setHistorico] = useState([])
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

        const respostas = await Promise.all(
          dados.map(async (edital) => {
            try {
              const res = await getHistoricoCronograma(edital.id)
              const hist = await res.json().catch(() => null)
              return [edital.id, Array.isArray(hist) ? hist : []]
            } catch {
              return [edital.id, []]
            }
          })
        )
        if (ativo) setHistoricoPorEdital(Object.fromEntries(respostas))
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
    setSucesso('Edital salvo com sucesso.')
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
    } finally {
      setProcessando(false)
    }
  }

  async function abrirHistorico(edital) {
    setEditalHistorico(edital)
    setHistorico([])
    setCarregandoHistorico(true)
    try {
      const res = await getHistoricoCronograma(edital.id)
      const dados = await res.json().catch(() => null)
      if (!res.ok) throw new Error(dados?.detail || 'Erro ao carregar histórico de prazos.')
      setHistorico(Array.isArray(dados) ? dados : [])
    } catch (error) {
      toast({ message: error.message || 'Erro ao carregar histórico de prazos.', tone: 'error' })
    } finally {
      setCarregandoHistorico(false)
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
      setSucesso(
        acao === 'publicar' ? 'Edital publicado com sucesso.' : 'Edital encerrado com sucesso.'
      )
    } catch (error) {
      setErro(error.message || 'Falha ao conectar ao servidor.')
    } finally {
      setProcessando(false)
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

  function datasPorCampo(edital, campo) {
    const alteracoes = (historicoPorEdital[edital.id] || []).filter((item) => item.campo === campo)
    if (alteracoes.length === 0) return edital[campo] ? [edital[campo]] : ['—']
    const sequencia = []
    if (alteracoes[0]?.data_anterior) sequencia.push(alteracoes[0].data_anterior)
    alteracoes.forEach((alt) => {
      if (alt.data_nova) sequencia.push(alt.data_nova)
    })
    if (edital[campo] && sequencia[sequencia.length - 1] !== edital[campo])
      sequencia.push(edital[campo])
    return sequencia.length > 0 ? sequencia : ['—']
  }

  const linhasHistorico = historico.map((item) => [
    item.campo_display || item.campo || '—',
    formatarData(item.data_anterior),
    formatarData(item.data_nova),
    item.responsavel || '—',
    item.alterado_em || '—',
  ])

  const linhas = editais.map((edital) => [
    edital.nome,
    edital.ano_codigo,
    <Badge key={`status-${edital.id}`} status={edital.status} />,
    <div
      key={`datas-${edital.id}`}
      style={{ display: 'grid', rowGap: 4, minWidth: 280, textAlign: 'left' }}
    >
      {DATAS_CHAVE.map(([rotulo, campo]) => (
        <div
          key={`${edital.id}-${campo}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '150px 1fr',
            alignItems: 'center',
            columnGap: 8,
          }}
        >
          <strong style={{ fontSize: 12 }}>{rotulo}:</strong>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {datasPorCampo(edital, campo).map((data, index, lista) => {
              const antiga = index < lista.length - 1
              return (
                <span
                  key={`${edital.id}-${campo}-${index}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      textDecoration: antiga ? 'line-through' : 'none',
                      opacity: antiga ? 0.55 : 1,
                    }}
                  >
                    {data === '—' ? '—' : formatarData(data)}
                  </span>
                  {antiga && (
                    <span
                      aria-hidden="true"
                      style={{
                        opacity: 0.55,
                        display: 'inline-flex',
                        alignItems: 'center',
                        transform: 'scaleX(-1)',
                      }}
                    >
                      <IconArrowLeft size={10} />
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      ))}
    </div>,
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
                setSucesso('')
                setEditalEdicao(null)
                setMostrarFormulario(true)
              }}
            >
              Novo edital
            </Button>
          )
        }
      />

      {sucesso && <Alert tone="success">{sucesso}</Alert>}
      {erro && <Alert tone="error">{erro}</Alert>}
      {processando && <p role="status">Processando...</p>}

      {carregando ? (
        <p role="status">Carregando editais...</p>
      ) : (
        <DataTable
          columns={['Nome', 'Ano-Código', 'Status', 'Datas', 'Documento', 'Ações']}
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
          onClose={() => setEditalHistorico(null)}
          width={800}
        >
          <DataTable
            columns={COLUNAS_HISTORICO}
            rows={linhasHistorico}
            loading={carregandoHistorico}
            emptyMessage="Nenhuma alteração de prazo registrada para este edital."
          />
        </Modal>
      )}
    </>
  )
}
