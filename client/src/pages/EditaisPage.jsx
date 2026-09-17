import { useEffect, useState } from 'react'
import { editaisFetch } from '../api'
import { Alert, Badge, Button, DataTable, PageHeader, useConfirm } from '../components'
import EditalForm from './EditalForm'

export default function EditaisPage() {
  const [editais, setEditais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [editalEdicao, setEditalEdicao] = useState(null)
  const [processando, setProcessando] = useState(false)
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
    setSucesso('Edital salvo com sucesso.')
  }

  async function abrirEdicao(edital) {
    setProcessando(true)
    setErro('')
    setSucesso('')

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

  async function alterarStatus(edital, acao) {
    setProcessando(true)
    setErro('')
    setSucesso('')

    try {
      const response = await editaisFetch(`/${edital.id}/${acao}/`, {
        method: 'POST',
      })
      const dados = await response.json().catch(() => null)

      if (!response.ok) {
        const mensagem =
          acao === 'publicar' && response.status === 400 && !dados?.detail
            ? 'Para publicar, preencha as sete datas em ordem no botão Editar.'
            : dados?.detail || 'Não foi possível alterar o status.'

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
    <div key={`acoes-${edital.id}`} style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {['RASCUNHO', 'EM_VIGOR'].includes(edital.status) ? (
        <>
          <Button
            size="sm"
            disabled={processando || mostrarFormulario}
            onClick={() => abrirEdicao(edital)}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant={edital.status === 'RASCUNHO' ? 'accent' : 'danger'}
            disabled={processando || mostrarFormulario}
            onClick={() => confirmarStatus(edital)}
          >
            {edital.status === 'RASCUNHO' ? 'Publicar' : 'Encerrar'}
          </Button>
        </>
      ) : (
        'Sem ações disponíveis'
      )}
    </div>,
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
