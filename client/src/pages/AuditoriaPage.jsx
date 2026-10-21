import { useEffect, useState } from 'react'
import { auditoriaFetch } from '../api'
import {
  Alert,
  Badge,
  Button,
  DataTable,
  FormField,
  PageHeader,
  Paginacao,
  Select,
  TextInput,
} from '../components'
import './AuditoriaPage.css'

const POR_PAGINA = 10

const CAMPOS_VAZIOS = {
  inicio: '',
  fim: '',
  acao: '',
  entidade: '',
  usuario: '',
  descricao: '',
}

function mensagemErro(dados) {
  if (typeof dados?.detail === 'string') return dados.detail

  const mensagens = Object.values(dados || {})
    .flat()
    .filter((item) => typeof item === 'string')

  return mensagens.join(' ') || 'Não foi possível consultar os logs.'
}

export default function AuditoriaPage() {
  const [campos, setCampos] = useState(CAMPOS_VAZIOS)
  const [filtros, setFiltros] = useState({ ...CAMPOS_VAZIOS, pagina: 1 })
  const [opcoes, setOpcoes] = useState({ acoes: [], entidades: [] })
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    auditoriaFetch('/opcoes/')
      .then((response) => (response.ok ? response.json() : null))
      .then((dados) => {
        if (ativo && dados) setOpcoes(dados)
      })
      .catch(() => {})

    return () => {
      ativo = false
    }
  }, [])

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

        Object.keys(CAMPOS_VAZIOS).forEach((nome) => {
          const valor = filtros[nome].trim()
          if (valor) parametros.set(nome, valor)
        })

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

  function atualizarCampo(nome) {
    return (event) => setCampos((atuais) => ({ ...atuais, [nome]: event.target.value }))
  }

  function filtrar(event) {
    event.preventDefault()
    setFiltros({ ...campos, pagina: 1 })
  }

  function limpar() {
    setCampos(CAMPOS_VAZIOS)
    setFiltros({ ...CAMPOS_VAZIOS, pagina: 1 })
  }

  function mudarPagina(pagina) {
    setFiltros((atuais) => ({ ...atuais, pagina }))
  }

  const linhas = logs.map((log) => [
    new Date(log.data_hora).toLocaleString('pt-BR'),
    <Badge key="acao" status={log.acao} label={log.acao_display} />,
    log.usuario_email ? `${log.usuario_nome} (${log.usuario_email})` : log.usuario_nome,
    log.entidade_display,
    log.descricao,
  ])

  return (
    <>
      <PageHeader title="Auditoria" />

      <form onSubmit={filtrar} className="auditoria-filtros">
        <FormField label="Data inicial">
          <TextInput type="date" value={campos.inicio} onChange={atualizarCampo('inicio')} />
        </FormField>

        <FormField label="Data final">
          <TextInput type="date" value={campos.fim} onChange={atualizarCampo('fim')} />
        </FormField>

        <FormField label="Ação">
          <Select value={campos.acao} onChange={atualizarCampo('acao')}>
            <option value="">Todas</option>
            {opcoes.acoes.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Entidade">
          <Select value={campos.entidade} onChange={atualizarCampo('entidade')}>
            <option value="">Todas</option>
            {opcoes.entidades.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Usuário">
          <TextInput
            type="search"
            placeholder="Nome ou e-mail"
            value={campos.usuario}
            onChange={atualizarCampo('usuario')}
          />
        </FormField>

        <div className="auditoria-filtros__descricao">
          <FormField label="Descrição">
            <TextInput
              type="search"
              placeholder="Trecho da descrição"
              value={campos.descricao}
              onChange={atualizarCampo('descricao')}
            />
          </FormField>
        </div>

        <div className="auditoria-filtros__acoes">
          <Button type="button" variant="outline" onClick={limpar}>
            Limpar
          </Button>
          <Button type="submit" variant="accent" loading={carregando}>
            Filtrar
          </Button>
        </div>
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
