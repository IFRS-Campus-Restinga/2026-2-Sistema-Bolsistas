import { useEffect, useState } from 'react'
import { frequenciasFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  DataTable,
  FormField,
  IconAlertTriangle,
  IconCheck,
  IconX,
  Modal,
  PageHeader,
  Select,
  StatCard,
} from '../components'
import { formatarMes } from '../utils/mesReferencia'
import { mensagemDeErro } from '../utils/mensagemDeErro'

const ANO_ATUAL = new Date().getFullYear()
const ANOS = [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2]

// Só os meses em que o aluno era bolsista; os demais vêm como null do backend.
function mesesDoBolsista(linha, meses) {
  return linha.meses
    .map((celula, indice) => celula && { ...celula, mes: meses[indice] })
    .filter(Boolean)
}

function contar(celulas, status) {
  return celulas.filter((celula) => celula.status === status).length
}

function Contagem({ valor, tom }) {
  if (!valor) return <span className="text-gray-300">0</span>
  return <span className={`font-semibold ${tom}`}>{valor}</span>
}

function FrequenciasDoBolsistaModal({ linha, celulas, ano, onFechar }) {
  const linhas = [...celulas].reverse().map((celula) => [
    formatarMes(celula.mes),
    <Badge key="status" status={celula.status} />,
    celula.pendente ? (
      <span key="obs" className="text-sm font-medium text-red-600">
        Prazo vencido sem lançamento
      </span>
    ) : celula.fora_do_prazo ? (
      <span key="obs" className="text-sm text-amber-600">
        Lançada fora do prazo
      </span>
    ) : (
      <span key="obs" className="text-gray-300">
        —
      </span>
    ),
  ])

  return (
    <Modal title={`Frequências de ${linha.aluno_nome} em ${ano}`} onClose={onFechar} width={560}>
      <p className="mb-4 text-sm text-gray-500">
        {linha.projeto_titulo} · {linha.edital_ano_codigo} · {linha.coordenador_projeto_nome}
      </p>
      <DataTable columns={['Mês', 'Frequência', 'Prazo']} rows={linhas} porPagina={null} />
    </Modal>
  )
}

function opcoesUnicas(linhas, campo) {
  return [...new Set(linhas.map((linha) => linha[campo]))].sort()
}

export default function SituacaoFrequenciasPage() {
  const [ano, setAno] = useState(ANO_ATUAL)
  const [situacao, setSituacao] = useState(null)
  const [coordenador, setCoordenador] = useState('')
  const [projeto, setProjeto] = useState('')
  const [detalhando, setDetalhando] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setCarregando(true)
      try {
        const response = await frequenciasFetch(`/area/situacao/?ano=${ano}`)
        const dados = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(dados?.bolsistas)) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar as frequências.'))
        }
        if (ativo) {
          setSituacao(dados)
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
  }, [ano])

  const meses = situacao?.meses ?? []
  const bolsistas = situacao?.bolsistas ?? []
  const totais = situacao?.totais ?? {}

  const doCoordenador = coordenador
    ? bolsistas.filter((linha) => linha.coordenador_projeto_nome === coordenador)
    : bolsistas
  const coordenadores = opcoesUnicas(bolsistas, 'coordenador_projeto_nome')
  // A lista de projetos acompanha o coordenador escolhido.
  const projetos = opcoesUnicas(doCoordenador, 'projeto_titulo')
  const visiveis = projeto
    ? doCoordenador.filter((linha) => linha.projeto_titulo === projeto)
    : doCoordenador

  function trocarCoordenador(valor) {
    setCoordenador(valor)
    setProjeto('')
  }

  const linhas = visiveis.map((linha) => {
    const celulas = mesesDoBolsista(linha, meses)
    const atrasadas = celulas.filter((celula) => celula.pendente).length
    return [
      <div key="aluno" className="text-left">
        <p className="font-medium whitespace-nowrap text-gray-900">{linha.aluno_nome}</p>
        {linha.status_vinculo === 'DESLIGADO' && <Badge status="DESLIGADO" />}
      </div>,
      <div key="projeto" className="text-left">
        <p>{linha.projeto_titulo}</p>
        <p className="text-xs text-gray-400">
          {linha.edital_ano_codigo} · {linha.coordenador_projeto_nome}
        </p>
      </div>,
      <Contagem key="registradas" valor={contar(celulas, 'REGISTRADA')} tom="text-green-700" />,
      <Contagem
        key="nao-registradas"
        valor={contar(celulas, 'NAO_REGISTRADA')}
        tom="text-red-700"
      />,
      <div key="nao-informadas" className="flex flex-col items-center gap-0.5">
        <Contagem valor={contar(celulas, 'NAO_INFORMADO')} tom="text-gray-700" />
        {atrasadas > 0 && (
          <span className="text-xs font-semibold text-red-600">
            {atrasadas === 1 ? '1 em atraso' : `${atrasadas} em atraso`}
          </span>
        )}
      </div>,
      <AcoesCell
        key="acoes"
        acoes={[
          {
            label: 'Ver frequências',
            variant: 'outline',
            onClick: () => setDetalhando({ linha, celulas }),
          },
        ]}
      />,
    ]
  })

  return (
    <>
      <PageHeader title="Situação das Frequências" />

      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="mb-6 grid grid-cols-[repeat(3,1fr)] gap-4">
        <StatCard
          label="Registradas"
          value={totais.REGISTRADA ?? 0}
          icon={<IconCheck />}
          color="green"
        />
        <StatCard
          label="Não Registradas"
          value={totais.NAO_REGISTRADA ?? 0}
          icon={<IconX />}
          color="red"
        />
        <StatCard
          label="Não Informadas"
          value={totais.NAO_INFORMADO ?? 0}
          icon={<IconAlertTriangle />}
          color="orange"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <FormField label="Ano" className="mb-0 min-w-[140px]">
          <Select value={ano} onChange={(event) => setAno(Number(event.target.value))}>
            {ANOS.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Coordenador de projeto" className="mb-0 min-w-[260px]">
          <Select value={coordenador} onChange={(event) => trocarCoordenador(event.target.value)}>
            <option value="">Todos</option>
            {coordenadores.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Projeto" className="mb-0 min-w-[260px]">
          <Select value={projeto} onChange={(event) => setProjeto(event.target.value)}>
            <option value="">Todos</option>
            {projetos.map((titulo) => (
              <option key={titulo} value={titulo}>
                {titulo}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <DataTable
        columns={[
          'Bolsista',
          'Projeto',
          'Registradas',
          'Não Registradas',
          'Não Informadas',
          'Ações',
        ]}
        rows={linhas}
        loading={carregando}
        emptyMessage="Nenhum bolsista da sua área neste ano."
      />

      {detalhando && (
        <FrequenciasDoBolsistaModal
          linha={detalhando.linha}
          celulas={detalhando.celulas}
          ano={ano}
          onFechar={() => setDetalhando(null)}
        />
      )}
    </>
  )
}
