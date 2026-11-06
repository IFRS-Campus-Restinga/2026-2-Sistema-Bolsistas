import { useEffect, useState } from 'react'
import { bolsasFetch, bolsistasFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  DataTable,
  FormField,
  PageHeader,
  Select,
  useConfirm,
  useToast,
} from '../components'
import { mensagemDeErro } from '../utils/mensagemDeErro'

const FILTROS = {
  andamento: { rotulo: 'Em andamento', aceita: (bolsa) => bolsa.status !== 'ENCERRADA' },
  encerradas: { rotulo: 'Encerradas', aceita: (bolsa) => bolsa.status === 'ENCERRADA' },
  todas: { rotulo: 'Todas', aceita: () => true },
}

function Situacao({ bolsa }) {
  if (bolsa.status === 'ENCERRADA') {
    return <span className="text-sm text-gray-400">Bolsa encerrada</span>
  }
  if (bolsa.pode_finalizar) {
    return <span className="text-sm font-medium text-green-700">Pronta para finalizar</span>
  }
  return <p className="max-w-[320px] text-left text-xs text-gray-500">{bolsa.motivo_bloqueio}</p>
}

export default function FinalizacaoBolsasPage() {
  const confirmar = useConfirm()
  const toast = useToast()
  const [bolsas, setBolsas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('andamento')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const response = await bolsistasFetch('/bolsas/')
        const dados = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(dados)) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar as bolsas.'))
        }
        if (ativo) {
          setBolsas(dados)
          setErro('')
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
  }, [versao])

  function finalizar(bolsa) {
    confirmar({
      title: 'Finalizar bolsa?',
      message: `A bolsa do projeto "${bolsa.projeto_titulo}" será encerrada e não aceitará mais ações de acompanhamento. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Finalizar',
      tone: 'accent',
      onConfirm: async () => {
        const response = await bolsasFetch(`/${bolsa.id}/finalizar/`, { method: 'POST' })
        const dados = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível finalizar a bolsa.'))
        }
        toast({ message: 'Bolsa finalizada.', tone: 'success' })
        setVersao((atual) => atual + 1)
      },
    })
  }

  const visiveis = bolsas.filter(FILTROS[filtro].aceita)

  const linhas = visiveis.map((bolsa) => [
    <div key="projeto" className="text-left">
      <p className="font-medium text-gray-900">{bolsa.projeto_titulo}</p>
      <p className="text-xs text-gray-400">{bolsa.coordenador_projeto_nome}</p>
    </div>,
    `${bolsa.edital_ano_codigo} · ${bolsa.tipo_display}`,
    <span key="relatorios" className="whitespace-nowrap">
      <strong className="text-gray-900">{bolsa.relatorios_aprovados}</strong> de{' '}
      {bolsa.total_bolsistas} {bolsa.total_bolsistas === 1 ? 'aprovado' : 'aprovados'}
    </span>,
    <Badge key="status" status={bolsa.status} />,
    <Situacao key="situacao" bolsa={bolsa} />,
    <AcoesCell
      key="acoes"
      mostrar={bolsa.status !== 'ENCERRADA'}
      acoes={[
        {
          label: 'Finalizar bolsa',
          variant: 'accent',
          disabled: !bolsa.pode_finalizar,
          onClick: () => finalizar(bolsa),
        },
      ]}
    />,
  ])

  return (
    <>
      <PageHeader title="Finalização de Bolsas" />

      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <FormField label="Bolsas" className="mb-0 min-w-[220px]">
          <Select value={filtro} onChange={(event) => setFiltro(event.target.value)}>
            {Object.entries(FILTROS).map(([valor, { rotulo }]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Select>
        </FormField>
        <p className="pb-2.5 text-sm text-gray-500">
          Uma bolsa é finalizada quando todos os bolsistas têm o relatório final aprovado e não há
          processos em aberto.
        </p>
      </div>

      <DataTable
        columns={['Projeto', 'Edital e tipo', 'Relatórios finais', 'Status', 'Situação', 'Ações']}
        rows={linhas}
        loading={carregando}
        emptyMessage={
          filtro === 'encerradas'
            ? 'Nenhuma bolsa encerrada ainda.'
            : 'Nenhuma bolsa com bolsistas na sua área.'
        }
      />
    </>
  )
}
