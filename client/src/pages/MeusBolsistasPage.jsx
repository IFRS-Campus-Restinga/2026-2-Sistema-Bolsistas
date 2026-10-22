import { useEffect, useState } from 'react'
import { bolsistasFetch } from '../api'
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
import { formatarData } from '../utils/dataHora'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import AvaliarRelatorioModal from './AvaliarRelatorioModal'

const SITUACOES = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'NAO_SOLICITADO', rotulo: 'Não solicitado' },
  { valor: 'SOLICITADO', rotulo: 'Solicitado' },
  { valor: 'AGUARDANDO_AVALIACAO', rotulo: 'Aguardando avaliação' },
  { valor: 'REPROVADO', rotulo: 'Reprovado' },
  { valor: 'APROVADO', rotulo: 'Aprovado' },
]

function situacaoDoRelatorio(vinculo) {
  return vinculo.relatorio?.situacao ?? 'NAO_SOLICITADO'
}

export default function MeusBolsistasPage() {
  const confirmar = useConfirm()
  const toast = useToast()
  const [vinculos, setVinculos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('')
  const [avaliando, setAvaliando] = useState(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const response = await bolsistasFetch('/vinculos/')
        const dados = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(dados)) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar os bolsistas.'))
        }
        if (ativo) setVinculos(dados)
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

  function solicitarRelatorio(vinculo) {
    confirmar({
      title: 'Solicitar relatório final?',
      message: `${vinculo.aluno_nome} poderá enviar o relatório final até ${formatarData(vinculo.prazo_relatorio)}, prazo definido no edital.`,
      confirmLabel: 'Solicitar',
      tone: 'accent',
      onConfirm: async () => {
        const response = await bolsistasFetch(`/vinculos/${vinculo.id}/solicitar-relatorio/`, {
          method: 'POST',
        })
        const dados = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível solicitar o relatório.'))
        }
        toast({ message: 'Relatório final solicitado.', tone: 'success' })
        setVersao((atual) => atual + 1)
      },
    })
  }

  function acoesDoVinculo(vinculo) {
    const situacao = situacaoDoRelatorio(vinculo)
    if (situacao === 'NAO_SOLICITADO') {
      return vinculo.pode_solicitar_relatorio
        ? [
            {
              label: 'Solicitar relatório final',
              variant: 'accent',
              onClick: () => solicitarRelatorio(vinculo),
            },
          ]
        : []
    }
    if (!vinculo.relatorio.arquivo) return []

    const baixar = {
      label: 'Baixar relatório',
      variant: 'outline',
      onClick: () => window.open(vinculo.relatorio.arquivo, '_blank', 'noopener'),
    }
    if (situacao === 'AGUARDANDO_AVALIACAO') {
      return [
        { label: 'Avaliar relatório', variant: 'accent', onClick: () => setAvaliando(vinculo) },
        baixar,
      ]
    }
    return [baixar]
  }

  const aprovados = vinculos.filter((vinculo) => situacaoDoRelatorio(vinculo) === 'APROVADO')
  const visiveis = filtro
    ? vinculos.filter((vinculo) => situacaoDoRelatorio(vinculo) === filtro)
    : vinculos

  const linhas = visiveis.map((vinculo) => [
    <div key="aluno" className="text-left">
      <p className="font-medium text-gray-900">{vinculo.aluno_nome}</p>
      <p className="text-xs text-gray-400">{vinculo.aluno_email}</p>
    </div>,
    vinculo.projeto_titulo,
    `${vinculo.edital_ano_codigo} · ${vinculo.bolsa_tipo_display}`,
    vinculo.origem_display,
    <div key="relatorio" className="flex flex-col items-center gap-1">
      <Badge status={situacaoDoRelatorio(vinculo)} />
      {vinculo.prazo_relatorio && !vinculo.relatorio?.arquivo && (
        <span className="text-xs text-gray-400">
          Prazo: {formatarData(vinculo.prazo_relatorio)}
        </span>
      )}
    </div>,
    <AcoesCell key="acoes" acoes={acoesDoVinculo(vinculo)} />,
  ])

  return (
    <>
      <PageHeader title="Meus Bolsistas" />

      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <FormField label="Situação do relatório final" className="mb-0 min-w-[240px]">
          <Select value={filtro} onChange={(event) => setFiltro(event.target.value)}>
            {SITUACOES.map((situacao) => (
              <option key={situacao.valor} value={situacao.valor}>
                {situacao.rotulo}
              </option>
            ))}
          </Select>
        </FormField>
        {!carregando && vinculos.length > 0 && (
          <span className="pb-2.5 text-sm text-gray-500">
            {aprovados.length} de {vinculos.length}{' '}
            {vinculos.length === 1 ? 'relatório aprovado' : 'relatórios aprovados'}
          </span>
        )}
      </div>

      <DataTable
        columns={['Bolsista', 'Projeto', 'Edital e tipo', 'Ingresso', 'Relatório final', 'Ações']}
        rows={linhas}
        loading={carregando}
        emptyMessage={
          filtro
            ? 'Nenhum bolsista com essa situação de relatório.'
            : 'Seus projetos ainda não têm bolsistas.'
        }
      />

      {avaliando && (
        <AvaliarRelatorioModal
          vinculo={avaliando}
          onFechar={() => setAvaliando(null)}
          onAvaliado={() => {
            setAvaliando(null)
            setVersao((atual) => atual + 1)
          }}
        />
      )}
    </>
  )
}
