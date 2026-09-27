import { useEffect, useState } from 'react'
import { editaisFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  Button,
  DataTable,
  PageHeader,
  useConfirm,
  useToast,
} from '../components'
import EditalForm from './EditalForm'

export default function EditaisPage() {
  const [editais, setEditais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [editalEdicao, setEditalEdicao] = useState(null)
  const [processando, setProcessando] = useState(false)
  const confirmar = useConfirm()
  const toast = useToast()

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
      toast({ message: error.message || 'Falha ao conectar ao servidor.', tone: 'error' })
    } finally {
      setProcessando(false)
    }
  }

  async function alterarStatus(edital, acao) {
    setProcessando(true)

    try {
      const response = await editaisFetch(`/${edital.id}/${acao}/`, {
        method: 'POST',
      })
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
      toast({ message: error.message || 'Falha ao conectar ao servidor.', tone: 'error' })
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
      Documento oficial
    </a>,
    <AcoesCell
      key={`acoes-${edital.id}`}
      mostrar={['RASCUNHO', 'EM_VIGOR'].includes(edital.status)}
      acoes={[
        {
          label: 'Editar',
          disabled: processando || mostrarFormulario,
          onClick: () => abrirEdicao(edital),
        },
        {
          label: edital.status === 'RASCUNHO' ? 'Publicar' : 'Encerrar',
          variant: edital.status === 'RASCUNHO' ? 'accent' : 'danger',
          disabled: processando || mostrarFormulario,
          onClick: () => confirmarStatus(edital),
        },
      ]}
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
                setEditalEdicao(null)
                setMostrarFormulario(true)
              }}
            >
              Novo edital
            </Button>
          )
        }
      />

      {erro && <Alert tone="error">{erro}</Alert>}
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
    </>
  )
}
