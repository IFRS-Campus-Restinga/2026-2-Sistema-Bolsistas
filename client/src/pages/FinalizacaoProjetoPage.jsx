import { useEffect, useState } from 'react'
import { bolsasFetch, bolsistasFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  Button,
  Carregando,
  FormField,
  IconAlertTriangle,
  IconCheck,
  PageHeader,
  Select,
  useConfirm,
  useToast,
} from '../components'
import { formatarData, formatarDataHora } from '../utils/dataHora'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import AvaliarRelatorioModal from './AvaliarRelatorioModal'
import SolicitarRelatorioModal from './SolicitarRelatorioModal'

const FILTROS = {
  andamento: { rotulo: 'Em andamento', aceita: (bolsa) => bolsa.status !== 'ENCERRADA' },
  finalizadas: { rotulo: 'Finalizadas', aceita: (bolsa) => bolsa.status === 'ENCERRADA' },
}

function vigencia(bolsa) {
  if (!bolsa.data_inicio_vigencia || !bolsa.data_fim_vigencia) return 'Vigência não definida'
  return `Vigência ${formatarData(bolsa.data_inicio_vigencia)} a ${formatarData(bolsa.data_fim_vigencia)}`
}

function Bolsista({ vinculo, encerrada, onSolicitar, onAvaliar }) {
  const { relatorio } = vinculo
  const acoes = []
  if (!encerrada) {
    if (vinculo.pode_solicitar_relatorio) {
      acoes.push({ label: 'Solicitar relatório', variant: 'accent', onClick: onSolicitar })
    }
    if (relatorio?.situacao === 'AGUARDANDO_AVALIACAO') {
      acoes.push({ label: 'Emitir parecer', variant: 'accent', onClick: onAvaliar })
    }
  }
  if (relatorio?.arquivo) {
    acoes.push({
      label: 'Baixar relatório',
      variant: 'outline',
      onClick: () => window.open(relatorio.arquivo, '_blank', 'noopener'),
    })
  }
  if (relatorio?.modelo) {
    acoes.push({
      label: 'Baixar modelo enviado',
      variant: 'outline',
      onClick: () => window.open(relatorio.modelo, '_blank', 'noopener'),
    })
  }

  // Sem ação possível, explica o porquê em vez de deixar a linha muda.
  let aviso = ''
  if (!encerrada && !relatorio && !vinculo.pode_solicitar_relatorio) {
    aviso = vinculo.motivo_bloqueio_solicitacao
  } else if (!encerrada && relatorio?.situacao === 'SOLICITADO') {
    aviso = 'Aguardando envio do bolsista.'
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="min-w-[160px] flex-1">
        <p className="font-medium text-gray-900">{vinculo.aluno_nome}</p>
        <p className="text-xs text-gray-400">{vinculo.aluno_email}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge status={relatorio?.situacao ?? 'NAO_SOLICITADO'} />
        {relatorio?.fora_do_prazo && <Badge status="PENDENTE" label="Fora do prazo" />}
      </div>
      <div className="flex min-w-[200px] items-center justify-end gap-3">
        {aviso && <span className="max-w-[260px] text-right text-xs text-gray-500">{aviso}</span>}
        {acoes.length > 0 && <AcoesCell acoes={acoes} />}
      </div>
    </li>
  )
}

function Situacao({ bolsa }) {
  if (bolsa.status === 'ENCERRADA') return null
  if (bolsa.pode_finalizar) {
    return (
      <div className="flex items-center gap-2 border-t border-gray-100 bg-green-50 px-5 py-3 text-sm text-green-800">
        <IconCheck size={16} /> Sem pendências. A bolsa pode ser finalizada.
      </div>
    )
  }
  return (
    <div className="flex gap-2.5 border-t border-gray-100 bg-gray-50 px-5 py-3 text-sm text-gray-600">
      <span className="mt-0.5 text-amber-500">
        <IconAlertTriangle size={16} />
      </span>
      <div>
        <p className="font-medium text-gray-800">Para finalizar, resolva:</p>
        <ul className="mt-1 pl-4">
          {bolsa.motivos_bloqueio.map((motivo) => (
            <li key={motivo}>{motivo}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function CartaoBolsa({ bolsa, onFinalizar, onSolicitar, onAvaliar }) {
  const encerrada = bolsa.status === 'ENCERRADA'

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <p className="text-xs text-gray-500">
            {bolsa.projeto_titulo} · {bolsa.edital_ano_codigo}
          </p>
          <h2 className="text-[15px] font-bold text-gray-900">
            {bolsa.modalidade_display} · {bolsa.carga_horaria_semanal}h
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {vigencia(bolsa)}
            {bolsa.prazo_relatorio && (
              <span>Relatórios até {formatarData(bolsa.prazo_relatorio)}</span>
            )}
            {bolsa.prazo_relatorio_encerrado && (
              <Badge status="REPROVADO" label="Prazo do relatório encerrado" />
            )}
          </p>
        </div>
        {encerrada ? (
          <div className="text-right text-xs text-gray-500">
            <Badge status="ENCERRADA" label="Finalizada" />
            {bolsa.finalizada_em && (
              <p className="mt-1">
                por {bolsa.finalizada_por_nome} em {formatarDataHora(bolsa.finalizada_em)}
              </p>
            )}
            {bolsa.finalizada_em && (
              <p>
                {bolsa.ciencia_finalizacao_em
                  ? `Área ciente em ${formatarDataHora(bolsa.ciencia_finalizacao_em)}`
                  : 'Aguardando ciência da área'}
              </p>
            )}
          </div>
        ) : (
          <Button variant="accent" disabled={!bolsa.pode_finalizar} onClick={onFinalizar}>
            Finalizar bolsa
          </Button>
        )}
      </header>

      {bolsa.bolsistas.length > 0 ? (
        <ul className="list-none divide-y divide-gray-100">
          {bolsa.bolsistas.map((vinculo) => (
            <Bolsista
              key={vinculo.id}
              vinculo={vinculo}
              encerrada={encerrada}
              onSolicitar={() => onSolicitar(vinculo)}
              onAvaliar={() => onAvaliar(vinculo)}
            />
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-gray-400">Nenhum bolsista ativo nesta bolsa.</p>
      )}

      <Situacao bolsa={bolsa} />
    </article>
  )
}

export default function FinalizacaoProjetoPage() {
  const confirmar = useConfirm()
  const toast = useToast()
  const [bolsas, setBolsas] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('andamento')
  const [avaliando, setAvaliando] = useState(null)
  const [solicitando, setSolicitando] = useState(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const response = await bolsistasFetch('/projeto/bolsas/')
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
      }
    }

    carregar()
    return () => {
      ativo = false
    }
  }, [versao])

  const recarregar = () => setVersao((atual) => atual + 1)

  function finalizar(bolsa) {
    confirmar({
      title: 'Finalizar bolsa?',
      message: `A bolsa ${bolsa.modalidade_display} do projeto "${bolsa.projeto_titulo}" será encerrada e a coordenação de área tomará ciência. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Finalizar bolsa',
      tone: 'accent',
      onConfirm: async () => {
        const response = await bolsasFetch(`/${bolsa.id}/finalizar/`, { method: 'POST' })
        const dados = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível finalizar a bolsa.'))
        }
        toast({ message: 'Bolsa finalizada.', tone: 'success' })
        recarregar()
      },
    })
  }

  const visiveis = bolsas?.filter(FILTROS[filtro].aceita) ?? []

  return (
    <>
      <PageHeader title="Finalização" />

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
        <p className="max-w-[560px] pb-2.5 text-sm text-gray-500">
          Solicite o relatório final de cada bolsista, emita o parecer e finalize a bolsa quando não
          houver pendências. A coordenação de área é avisada para tomar ciência.
        </p>
      </div>

      {erro && <Alert tone="error">{erro}</Alert>}

      {!bolsas && !erro && <Carregando texto="Carregando bolsas..." />}

      {bolsas && visiveis.length === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-card">
          <p className="text-base font-medium text-gray-500">
            {filtro === 'finalizadas'
              ? 'Nenhuma bolsa finalizada ainda.'
              : 'Nenhuma bolsa com bolsistas em andamento.'}
          </p>
          {filtro === 'andamento' && (
            <p className="mt-1 text-sm text-gray-400">
              As bolsas aparecem aqui quando tiverem bolsistas vinculados.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {visiveis.map((bolsa) => (
          <CartaoBolsa
            key={bolsa.id}
            bolsa={bolsa}
            onFinalizar={() => finalizar(bolsa)}
            onSolicitar={setSolicitando}
            onAvaliar={setAvaliando}
          />
        ))}
      </div>

      {solicitando && (
        <SolicitarRelatorioModal
          vinculo={solicitando}
          onFechar={() => setSolicitando(null)}
          onSolicitado={() => {
            setSolicitando(null)
            recarregar()
          }}
        />
      )}

      {avaliando && (
        <AvaliarRelatorioModal
          vinculo={avaliando}
          onFechar={() => setAvaliando(null)}
          onAvaliado={() => {
            setAvaliando(null)
            recarregar()
          }}
        />
      )}
    </>
  )
}
