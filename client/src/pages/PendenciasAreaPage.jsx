import { useEffect, useState } from 'react'
import { frequenciasFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  Carregando,
  DataTable,
  PageHeader,
  useConfirm,
  useToast,
} from '../components'
import { formatarData, formatarDataHora } from '../utils/dataHora'
import { formatarMes } from '../utils/mesReferencia'
import { mensagemDeErro } from '../utils/mensagemDeErro'

function SituacaoSolicitacao({ pendencia }) {
  if (!pendencia.solicitada_em) return <span className="text-sm text-gray-400">Não solicitada</span>
  return (
    <div className="flex flex-col items-center gap-1">
      <Badge status="SOLICITADO" label="Solicitada" />
      <span className="text-xs text-gray-400">{formatarDataHora(pendencia.solicitada_em)}</span>
      {pendencia.lida_em && <span className="text-xs text-gray-400">Lida pelo coordenador</span>}
    </div>
  )
}

function GrupoDaBolsa({ grupo, onSolicitar }) {
  const linhasFrequencias = grupo.frequencias.map((pendencia) => [
    pendencia.aluno_nome,
    formatarMes(pendencia.mes_referencia),
    formatarData(pendencia.prazo),
    <SituacaoSolicitacao key="solicitacao" pendencia={pendencia} />,
    <AcoesCell
      key="acoes"
      mostrar={!pendencia.solicitada_em}
      acoes={[
        {
          label: 'Solicitar lançamento',
          variant: 'accent',
          onClick: () => onSolicitar(grupo, pendencia),
        },
      ]}
    />,
  ])

  const linhasRelatorios = grupo.relatorios.map((pendencia) => [
    pendencia.aluno_nome,
    <Badge key="situacao" status={pendencia.situacao} label={pendencia.situacao_display} />,
    formatarData(pendencia.prazo),
  ])

  return (
    <section className="mb-7 rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">{grupo.projeto_titulo}</h2>
          <p className="text-sm text-gray-500">
            Coordenador(a): {grupo.coordenador_projeto_nome} · {grupo.edital_ano_codigo} ·{' '}
            {grupo.tipo_display}
          </p>
        </div>
        <span className="text-sm text-gray-500">
          {grupo.frequencias.length + grupo.relatorios.length}{' '}
          {grupo.frequencias.length + grupo.relatorios.length === 1 ? 'pendência' : 'pendências'}
        </span>
      </div>

      {grupo.frequencias.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Frequências não informadas</h3>
          <DataTable
            columns={['Bolsista', 'Mês', 'Prazo', 'Solicitação', 'Ações']}
            rows={linhasFrequencias}
            porPagina={null}
          />
        </div>
      )}

      {grupo.relatorios.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            Relatórios finais não enviados no prazo
          </h3>
          <DataTable
            columns={['Bolsista', 'Situação', 'Prazo']}
            rows={linhasRelatorios}
            porPagina={null}
          />
        </div>
      )}
    </section>
  )
}

export default function PendenciasAreaPage() {
  const confirmar = useConfirm()
  const toast = useToast()
  const [grupos, setGrupos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const response = await frequenciasFetch('/area/pendencias/')
        const dados = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(dados)) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar as pendências.'))
        }
        if (ativo) {
          setGrupos(dados)
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

  function solicitar(grupo, pendencia) {
    confirmar({
      title: 'Solicitar lançamento da frequência?',
      message: `${grupo.coordenador_projeto_nome} será notificado(a) para lançar a frequência de ${pendencia.aluno_nome} referente a ${formatarMes(pendencia.mes_referencia)}.`,
      confirmLabel: 'Solicitar',
      tone: 'accent',
      onConfirm: async () => {
        const response = await frequenciasFetch('/solicitacoes/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vinculo: pendencia.vinculo_id,
            mes_referencia: pendencia.mes_referencia,
          }),
        })
        const dados = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível enviar a solicitação.'))
        }
        toast({ message: 'Solicitação enviada ao coordenador do projeto.', tone: 'success' })
        setVersao((atual) => atual + 1)
      },
    })
  }

  return (
    <>
      <PageHeader title="Relatório de Pendências" />

      {erro && <Alert tone="error">{erro}</Alert>}

      {carregando ? (
        <Carregando />
      ) : (
        !erro &&
        (grupos.length === 0 ? (
          <Alert tone="success">Nenhuma pendência de frequência ou relatório na sua área.</Alert>
        ) : (
          grupos.map((grupo) => (
            <GrupoDaBolsa key={grupo.bolsa_id} grupo={grupo} onSolicitar={solicitar} />
          ))
        ))
      )}
    </>
  )
}
