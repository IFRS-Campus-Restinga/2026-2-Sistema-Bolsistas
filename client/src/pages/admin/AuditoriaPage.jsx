import { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  DataTable,
  FormField,
  PageHeader,
  Select,
  TextInput,
} from '../../components'
import { getLogsAuditoria, getUsuarios } from '../../api'
import { useToast } from '../../components'

const COLUNAS = ['Data/Hora', 'Usuário', 'Ação', 'Recurso']

function formatarTimestamp(ts) {
  if (!ts) return '—'
  // Backend envia "DD/MM/YYYY HH:MM:SS" — exibir como "DD/MM/YYYY HH:MM"
  const match = typeof ts === 'string' && ts.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/)
  if (match) return `${match[1]} ${match[2]}`
  // Fallback para ISO ou outros formatos
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function linhasTabela(logs) {
  return logs.map((log) => {
    const recursoBase = log.recurso || '—'
    const alteradoBruto =
      log.registro_alterado && log.registro_alterado !== '—'
        ? log.registro_alterado
        : log.detalhe && log.detalhe !== '—'
          ? log.detalhe
          : ''

    const itensAlterados = alteradoBruto
      ? alteradoBruto
          .split(' | ')
          .map((item) => item.trim())
          .filter(Boolean)
      : []

    const recursoConteudo = (
      <div style={{ textAlign: 'left', lineHeight: 1.35 }}>
        <div>{recursoBase}</div>
        {itensAlterados.length > 0 && (
          <div style={{ marginTop: 6, color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text)' }}>Alterado:</strong>
            {itensAlterados.map((item, index) => (
              <div key={`${log.id}-alt-${index}`}>• {item}</div>
            ))}
          </div>
        )}
      </div>
    )

    return [
      formatarTimestamp(log.timestamp),
      log.ator || '(sistema)',
      <Badge key="acao" status={log.acao || '—'} />,
      recursoConteudo,
    ]
  })
}

export default function AuditoriaPage({ mostrarFiltroUsuario = true }) {
  const toast = useToast()

  const [logs, setLogs] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [count, setCount] = useState(0)
  const [temProxima, setTemProxima] = useState(false)
  const [temAnterior, setTemAnterior] = useState(false)

  const [filtros, setFiltros] = useState({ usuario: '', dataInicio: '', dataFim: '' })

  const PAGE_SIZE = 25
  const totalPaginas = Math.max(1, Math.ceil(count / PAGE_SIZE))

  useEffect(() => {
    if (!mostrarFiltroUsuario) return
    getUsuarios()
      .then((res) => res.ok && res.json())
      .then((data) => Array.isArray(data) && setUsuarios(data))
      .catch(() => {})
  }, [mostrarFiltroUsuario])

  useEffect(() => {
    let ativo = true

    async function carregarLogs() {
      setCarregando(true)
      try {
        const res = await getLogsAuditoria({
          pagina,
          usuario: filtros.usuario || undefined,
          dataInicio: filtros.dataInicio || undefined,
          dataFim: filtros.dataFim || undefined,
        })
        if (!res.ok) throw new Error('Erro ao carregar logs')

        const data = await res.json()
        if (!ativo) return

        setLogs(data.results || [])
        setCount(data.count || 0)
        setTemProxima(!!data.next)
        setTemAnterior(!!data.previous)
      } catch {
        if (ativo) toast({ message: 'Erro ao carregar logs de auditoria.', tone: 'error' })
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarLogs()

    return () => {
      ativo = false
    }
  }, [pagina, filtros, toast])

  function limparFiltros() {
    const vazios = { usuario: '', dataInicio: '', dataFim: '' }
    setFiltros(vazios)
    setPagina(1)
  }

  function atualizarFiltro(chave, valor) {
    setPagina(1)
    setFiltros((f) => ({ ...f, [chave]: valor }))
  }

  const opcoesUsuario = [
    { value: '', label: 'Todos' },
    ...usuarios.map((u) => ({ value: u.id, label: u.nome || u.username })),
  ]

  return (
    <>
      <PageHeader title="Auditoria" />

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
          alignItems: 'flex-end',
        }}
      >
        {mostrarFiltroUsuario && (
          <FormField label="Usuário" style={{ flex: '1 1 180px' }}>
            <Select
              value={filtros.usuario}
              onChange={(e) => atualizarFiltro('usuario', e.target.value)}
            >
              {opcoesUsuario.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="De" style={{ flex: '1 1 140px' }}>
          <TextInput
            type="date"
            value={filtros.dataInicio}
            onChange={(e) => atualizarFiltro('dataInicio', e.target.value)}
          />
        </FormField>
        <FormField label="Até" style={{ flex: '1 1 140px' }}>
          <TextInput
            type="date"
            value={filtros.dataFim}
            onChange={(e) => atualizarFiltro('dataFim', e.target.value)}
          />
        </FormField>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'transparent', userSelect: 'none' }}>
            Ações
          </span>
          <Button variant="outline" onClick={limparFiltros}>
            Limpar filtros
          </Button>
        </div>
      </div>

      <DataTable
        columns={COLUNAS}
        rows={linhasTabela(logs)}
        loading={carregando}
        emptyMessage="Nenhum log encontrado."
      />

      {totalPaginas > 1 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginTop: 16,
            justifyContent: 'flex-end',
          }}
        >
          <Button
            variant="outline"
            size="sm"
            disabled={!temAnterior}
            onClick={() => setPagina((p) => p - 1)}
          >
            Anterior
          </Button>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Página {pagina} de {totalPaginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!temProxima}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </>
  )
}
