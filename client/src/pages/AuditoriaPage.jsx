import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  useToast,
} from '../components'

const POR_PAGINA = 10

// Campos e botões dos filtros com a mesma altura, para alinharem pela base.
const ALTURA_FILTRO = 'h-10'

// Botões herdam line-height "normal" do navegador; leading-[normal] mantém a mesma altura.
const PERIODO =
  'cursor-pointer rounded-full border px-3 py-1 text-xs leading-[normal] font-medium disabled:cursor-not-allowed disabled:opacity-50'
const PERIODO_NORMAL = `${PERIODO} border-gray-200 bg-white text-gray-700 enabled:hover:bg-gray-50`
const PERIODO_ATIVO = `${PERIODO} border-if-green bg-if-green text-white enabled:hover:bg-if-green-dark`

const CAMPOS_VAZIOS = {
  inicio: '',
  fim: '',
  acao: '',
  entidade: '',
  usuario: '',
  descricao: '',
}

const PERIODOS = [
  { rotulo: 'Hoje', dias: 0 },
  { rotulo: 'Últimos 7 dias', dias: 6 },
  { rotulo: 'Últimos 30 dias', dias: 29 },
]

function mensagemErro(dados) {
  if (typeof dados?.detail === 'string') return dados.detail

  const mensagens = Object.values(dados || {})
    .flat()
    .filter((item) => typeof item === 'string')

  return mensagens.join(' ') || 'Não foi possível consultar os logs.'
}

// Só aritmética sobre a data que veio do servidor; não consulta o relógio do navegador.
function deslocarData(dataIso, dias) {
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  const data = new Date(ano, mes - 1, dia + dias)
  const doisDigitos = (numero) => String(numero).padStart(2, '0')
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`
}

function somenteCampos(filtros) {
  return Object.fromEntries(Object.keys(CAMPOS_VAZIOS).map((nome) => [nome, filtros[nome]]))
}

function filtrosDaUrl(parametros) {
  const pagina = Number(parametros.get('pagina'))
  return {
    ...Object.fromEntries(
      Object.keys(CAMPOS_VAZIOS).map((nome) => [nome, parametros.get(nome) || ''])
    ),
    pagina: Number.isInteger(pagina) && pagina > 1 ? pagina : 1,
  }
}

function consultaDosFiltros(filtros) {
  const consulta = new URLSearchParams()
  Object.keys(CAMPOS_VAZIOS).forEach((nome) => {
    const valor = filtros[nome].trim()
    if (valor) consulta.set(nome, valor)
  })
  return consulta
}

export default function AuditoriaPage() {
  const toast = useToast()
  const [parametros, setParametros] = useSearchParams()
  const [filtros, setFiltros] = useState(() => filtrosDaUrl(parametros))
  const [campos, setCampos] = useState(() => somenteCampos(filtrosDaUrl(parametros)))
  const [opcoes, setOpcoes] = useState({ acoes: [], entidades: [], hoje: '' })
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [exportando, setExportando] = useState(false)
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

  // Mantém os filtros na URL: recarregar a página ou compartilhar o link reproduz a consulta.
  useEffect(() => {
    const consulta = consultaDosFiltros(filtros)
    consulta.set('aba', 'auditoria')
    if (filtros.pagina > 1) consulta.set('pagina', String(filtros.pagina))
    consulta.sort()

    const atual = new URLSearchParams(parametros)
    atual.sort()
    if (atual.toString() !== consulta.toString()) {
      setParametros(consulta, { replace: true })
    }
  }, [filtros, parametros, setParametros])

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setCarregando(true)
      setErro('')

      try {
        const consulta = consultaDosFiltros(filtros)
        consulta.set('pagina', String(filtros.pagina))
        consulta.set('por_pagina', String(POR_PAGINA))

        const response = await auditoriaFetch(`/logs/?${consulta}`)
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

  function aplicar(novosFiltros) {
    setFiltros({ ...novosFiltros, pagina: 1 })
    setCampos(somenteCampos(novosFiltros))
  }

  function filtrar(event) {
    event.preventDefault()
    aplicar(campos)
  }

  function limpar() {
    aplicar(CAMPOS_VAZIOS)
  }

  function aplicarFiltro(parcial) {
    aplicar({ ...filtros, ...parcial })
  }

  function aplicarPeriodo(dias) {
    aplicarFiltro({ inicio: deslocarData(opcoes.hoje, -dias), fim: opcoes.hoje })
  }

  function periodoAtivo(dias) {
    return (
      Boolean(opcoes.hoje) &&
      filtros.fim === opcoes.hoje &&
      filtros.inicio === deslocarData(opcoes.hoje, -dias)
    )
  }

  function mudarPagina(pagina) {
    setFiltros((atuais) => ({ ...atuais, pagina }))
  }

  async function exportar() {
    setExportando(true)
    try {
      const response = await auditoriaFetch(`/logs/exportar/?${consultaDosFiltros(filtros)}`)
      if (!response.ok) throw new Error('Não foi possível exportar os registros.')

      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `auditoria-${opcoes.hoje || 'registros'}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast({ message: error.message, tone: 'error' })
    } finally {
      setExportando(false)
    }
  }

  function celulaFiltravel(chave, conteudo, titulo, filtro) {
    return (
      <button
        key={chave}
        type="button"
        className="cursor-pointer rounded-md border-0 bg-transparent px-1 py-0.5 [font:inherit] text-inherit hover:bg-green-50 hover:underline hover:decoration-green-300"
        title={titulo}
        onClick={() => aplicarFiltro(filtro)}
      >
        {conteudo}
      </button>
    )
  }

  const linhas = logs.map((log) => [
    new Date(log.data_hora).toLocaleString('pt-BR'),
    celulaFiltravel(
      'acao',
      <Badge status={log.acao} label={log.acao_display} />,
      `Filtrar por ação: ${log.acao_display}`,
      { acao: log.acao }
    ),
    log.usuario_email
      ? celulaFiltravel(
          'usuario',
          `${log.usuario_nome} (${log.usuario_email})`,
          `Filtrar por usuário: ${log.usuario_nome}`,
          { usuario: log.usuario_email }
        )
      : log.usuario_nome,
    celulaFiltravel(
      'entidade',
      log.entidade_display,
      `Filtrar por entidade: ${log.entidade_display}`,
      { entidade: log.entidade }
    ),
    log.descricao,
  ])

  return (
    <>
      <PageHeader title="Auditoria" />

      <form
        onSubmit={filtrar}
        className="mb-5 grid grid-cols-4 items-end gap-x-4 gap-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-card max-[900px]:grid-cols-2 max-[520px]:grid-cols-1"
      >
        <div className="col-span-full flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">Período:</span>
          {PERIODOS.map((periodo) => (
            <button
              key={periodo.rotulo}
              type="button"
              className={periodoAtivo(periodo.dias) ? PERIODO_ATIVO : PERIODO_NORMAL}
              onClick={() => aplicarPeriodo(periodo.dias)}
              disabled={!opcoes.hoje}
              aria-pressed={periodoAtivo(periodo.dias)}
            >
              {periodo.rotulo}
            </button>
          ))}
        </div>

        <FormField className="mb-0" label="Data inicial">
          <TextInput
            className={ALTURA_FILTRO}
            type="date"
            value={campos.inicio}
            onChange={atualizarCampo('inicio')}
          />
        </FormField>

        <FormField className="mb-0" label="Data final">
          <TextInput
            className={ALTURA_FILTRO}
            type="date"
            value={campos.fim}
            onChange={atualizarCampo('fim')}
          />
        </FormField>

        <FormField className="mb-0" label="Ação">
          <Select className={ALTURA_FILTRO} value={campos.acao} onChange={atualizarCampo('acao')}>
            <option value="">Todas</option>
            {opcoes.acoes.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField className="mb-0" label="Entidade">
          <Select
            className={ALTURA_FILTRO}
            value={campos.entidade}
            onChange={atualizarCampo('entidade')}
          >
            <option value="">Todas</option>
            {opcoes.entidades.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField className="mb-0" label="Usuário">
          <TextInput
            className={ALTURA_FILTRO}
            type="search"
            placeholder="Nome ou e-mail"
            value={campos.usuario}
            onChange={atualizarCampo('usuario')}
          />
        </FormField>

        <div className="col-span-2 max-[520px]:col-auto">
          <FormField className="mb-0" label="Descrição">
            <TextInput
              className={ALTURA_FILTRO}
              type="search"
              placeholder="Trecho da descrição"
              value={campos.descricao}
              onChange={atualizarCampo('descricao')}
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-2 max-[900px]:col-span-2 max-[520px]:col-auto">
          <Button type="button" variant="outline" onClick={limpar} className={ALTURA_FILTRO}>
            Limpar
          </Button>
          <Button type="submit" variant="accent" loading={carregando} className={ALTURA_FILTRO}>
            Filtrar
          </Button>
        </div>
      </form>

      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="mb-2 flex min-h-[30px] items-center justify-between gap-3 text-sm text-gray-500">
        <span role="status">
          {!carregando &&
            !erro &&
            (total === 1 ? '1 registro encontrado' : `${total} registros encontrados`)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={exportar}
          loading={exportando}
          disabled={carregando || total === 0}
        >
          Exportar Excel
        </Button>
      </div>

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
