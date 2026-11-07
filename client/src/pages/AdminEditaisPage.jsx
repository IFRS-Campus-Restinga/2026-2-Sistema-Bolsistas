import { useEffect, useState } from 'react'
import { editaisFetch } from '../api'
import { Alert, DataTable, PageHeader, StatusPill, Tabs } from '../components'
import { formatarData } from '../utils/dataHora'
import { mensagemDeErro } from '../utils/mensagemDeErro'

// Arquivado aparece como "Encerrado" e fica escondido até marcar "Mostrar arquivados".
const ABAS = {
  todos: () => true,
  EM_VIGOR: (edital) => edital.status === 'EM_VIGOR',
  RASCUNHO: (edital) => edital.status === 'RASCUNHO',
  ENCERRADO: (edital) => ['ENCERRADO', 'ARQUIVADO'].includes(edital.status),
}

function periodoInscricoes(edital) {
  if (!edital.data_abertura_inscricoes || !edital.data_fechamento_inscricoes) return '—'
  return `${formatarData(edital.data_abertura_inscricoes)} – ${formatarData(edital.data_fechamento_inscricoes)}`
}

export default function AdminEditaisPage() {
  const [editais, setEditais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('todos')
  const [mostrarArquivados, setMostrarArquivados] = useState(false)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const response = await editaisFetch('/')
        const dados = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(dados)) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar os editais.'))
        }
        if (ativo) setEditais(dados)
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
  }, [])

  const visiveis = editais.filter(
    (edital) => (mostrarArquivados || edital.status !== 'ARQUIVADO') && ABAS[aba](edital)
  )
  const contar = (filtro) => editais.filter(filtro).length

  const linhas = visiveis.map((edital) => [
    <span key="nome" className="font-medium text-gray-900">
      {edital.nome}
    </span>,
    <span key="codigo" className="font-mono text-xs">
      {edital.ano_codigo}
    </span>,
    <span key="inscricoes" className="tabular-nums">
      {periodoInscricoes(edital)}
    </span>,
    edital.total_bolsas,
    <StatusPill key="status" status={edital.status} />,
  ])

  return (
    <>
      <PageHeader title="Editais" description="Todos os editais do campus." />

      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <Tabs
          value={aba}
          onChange={setAba}
          tabs={[
            { id: 'todos', label: 'Todos' },
            { id: 'EM_VIGOR', label: 'Em vigor', count: contar(ABAS.EM_VIGOR) },
            { id: 'RASCUNHO', label: 'Rascunhos', count: contar(ABAS.RASCUNHO) },
            { id: 'ENCERRADO', label: 'Encerrados' },
          ]}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={mostrarArquivados}
            onChange={(evento) => setMostrarArquivados(evento.target.checked)}
            className="accent-gray-900"
          />
          Mostrar arquivados
        </label>
      </div>

      <DataTable
        columns={['Edital', 'Código', 'Inscrições', 'Bolsas', 'Situação']}
        rows={linhas}
        loading={carregando}
        emptyMessage={editais.length ? 'Nenhum edital nesta aba.' : 'Nenhum edital cadastrado.'}
      />
    </>
  )
}
