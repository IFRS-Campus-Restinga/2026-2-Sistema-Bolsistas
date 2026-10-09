import { useEffect, useState } from 'react'
import { auditoriaFetch } from '../../api'
import { Alert, Button, DataTable, FormField, PageHeader, TextInput } from '../../components'

function formatarAcao(acao) {
  const texto = acao.toLowerCase().replaceAll('_', ' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function mensagemErro(dados) {
  if (typeof dados?.detail === 'string') return dados.detail

  const mensagens = Object.values(dados || {})
    .flat()
    .filter((item) => typeof item === 'string')

  return mensagens.join(' ') || 'Não foi possível consultar os logs.'
}

export default function AuditoriaPage() {
  const [campos, setCampos] = useState({
    inicio: '',
    fim: '',
  })
  const [filtros, setFiltros] = useState({
    inicio: '',
    fim: '',
  })
  const [logs, setLogs] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setCarregando(true)
      setErro('')

      try {
        const parametros = new URLSearchParams()

        if (filtros.inicio) parametros.set('inicio', filtros.inicio)
        if (filtros.fim) parametros.set('fim', filtros.fim)

        const consulta = parametros.toString()
        const caminho = consulta ? `/logs/?${consulta}` : '/logs/'
        const response = await auditoriaFetch(caminho)
        const resultado = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(mensagemErro(resultado))
        }

        if (ativo) setLogs(Array.isArray(resultado) ? resultado : [])
      } catch (error) {
        if (ativo) setErro(error.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [filtros])

  function filtrar(event) {
    event.preventDefault()
    setFiltros({ ...campos })
  }

  function limpar() {
    const vazios = { inicio: '', fim: '' }
    setCampos(vazios)
    setFiltros(vazios)
  }

  const linhas = logs.map((log) => [
    new Date(log.data_hora).toLocaleString('pt-BR'),
    formatarAcao(log.acao),
    log.usuario_email ? `${log.usuario_nome} (${log.usuario_email})` : log.usuario_nome,
    log.entidade,
    log.descricao,
  ])

  return (
    <>
      <PageHeader title="Log de Auditoria" />

      <form
        onSubmit={filtrar}
        style={{
          display: 'flex',
          alignItems: 'end',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <FormField label="Data inicial">
          <TextInput
            type="date"
            value={campos.inicio}
            onChange={(event) =>
              setCampos((atual) => ({
                ...atual,
                inicio: event.target.value,
              }))
            }
          />
        </FormField>

        <FormField label="Data final">
          <TextInput
            type="date"
            value={campos.fim}
            onChange={(event) =>
              setCampos((atual) => ({
                ...atual,
                fim: event.target.value,
              }))
            }
          />
        </FormField>

        <Button type="submit" variant="accent">
          Filtrar
        </Button>

        <Button type="button" variant="outline" onClick={limpar}>
          Limpar
        </Button>
      </form>

      {erro && <Alert tone="error">{erro}</Alert>}

      {carregando ? (
        <p role="status">Carregando logs...</p>
      ) : (
        <DataTable
          columns={['Data e hora', 'Ação', 'Usuário', 'Entidade', 'Descrição']}
          rows={linhas}
          emptyMessage="Nenhum registro de auditoria encontrado."
        />
      )}
    </>
  )
}
