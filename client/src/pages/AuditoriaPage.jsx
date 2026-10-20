import { useEffect, useState } from 'react'
import { auditoriaFetch } from '../api'
import {
  Alert,
  Button,
  DataTable,
  FormField,
  PageHeader,
  Paginacao,
  TextInput,
} from '../components'

const POR_PAGINA = 10

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
    pagina: 1,
  })
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setCarregando(true)
      setErro('')

      try {
        const parametros = new URLSearchParams({
          pagina: String(filtros.pagina),
          por_pagina: String(POR_PAGINA),
        })

        if (filtros.inicio) parametros.set('inicio', filtros.inicio)
        if (filtros.fim) parametros.set('fim', filtros.fim)

        const response = await auditoriaFetch(`/logs/?${parametros}`)
        const resultado = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(mensagemErro(resultado))
        }

        if (ativo) {
          setLogs(Array.isArray(resultado.results) ? resultado.results : [])
          setTotal(resultado.count ?? 0)
        }
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
    setFiltros({ ...campos, pagina: 1 })
  }

  function limpar() {
    setCampos({ inicio: '', fim: '' })
    setFiltros({ inicio: '', fim: '', pagina: 1 })
  }

  function mudarPagina(pagina) {
    setFiltros((atuais) => ({ ...atuais, pagina }))
  }

  const linhas = logs.map((log) => [
    new Date(log.data_hora).toLocaleString('pt-BR'),
    log.acao_display,
    log.usuario_email ? `${log.usuario_nome} (${log.usuario_email})` : log.usuario_nome,
    log.entidade_display,
    log.descricao,
  ])

  return (
    <>
      <PageHeader title="Auditoria" />

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

        <Button type="submit" variant="accent" loading={carregando}>
          Filtrar
        </Button>

        <Button type="button" variant="outline" onClick={limpar}>
          Limpar
        </Button>
      </form>

      {erro && <Alert tone="error">{erro}</Alert>}

      <DataTable
        columns={['Data e hora', 'Ação', 'Usuário', 'Entidade', 'Descrição']}
        rows={linhas}
        loading={carregando}
        porPagina={null}
        emptyMessage="Nenhum registro de auditoria encontrado."
      />

      {total > POR_PAGINA && (
        <Paginacao
          pagina={filtros.pagina}
          porPagina={POR_PAGINA}
          totalItens={total}
          onMudar={mudarPagina}
        />
      )}
    </>
  )
}
