import { useEffect, useState } from 'react'
import { frequenciasFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  Button,
  DataTable,
  FormField,
  PageHeader,
  TextInput,
  useConfirm,
  useToast,
} from '../components'
import { formatarData, formatarDataHora } from '../utils/dataHora'
import { formatarMes, mesAtual } from '../utils/mesReferencia'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import FrequenciaModal from './FrequenciaModal'
import MotivoModal from './MotivoModal'

function SituacaoFrequencia({ linha }) {
  const { frequencia } = linha
  return (
    <div className="flex flex-col items-center gap-1">
      <Badge status={linha.status} />
      {frequencia?.fora_do_prazo && <Badge status="PENDENTE" label="Lançada fora do prazo" />}
      {linha.pendente && <span className="text-xs font-medium text-red-600">Prazo vencido</span>}
      {frequencia?.observacoes && (
        <p className="max-w-[260px] text-xs text-gray-500">{frequencia.observacoes}</p>
      )}
    </div>
  )
}

function SituacaoPagamento({ frequencia }) {
  if (!frequencia) return <span className="text-sm text-gray-400">Aguarda a frequência</span>
  return (
    <div className="flex flex-col items-center gap-1">
      <Badge status={frequencia.status_pagamento} />
      {frequencia.justificativa_pagamento && (
        <p className="max-w-[220px] text-xs text-gray-500">{frequencia.justificativa_pagamento}</p>
      )}
    </div>
  )
}

export default function FrequenciasPage() {
  const confirmar = useConfirm()
  const toast = useToast()
  const [mes, setMes] = useState(mesAtual)
  const [linhas, setLinhas] = useState([])
  const [solicitacoes, setSolicitacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [lancando, setLancando] = useState(null)
  const [negando, setNegando] = useState(null)
  const [exportando, setExportando] = useState(false)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setCarregando(true)
      try {
        const [responseMes, responseSolicitacoes] = await Promise.all([
          frequenciasFetch(`/?mes=${mes}`),
          frequenciasFetch('/solicitacoes/recebidas/'),
        ])
        const [dadosMes, dadosSolicitacoes] = await Promise.all([
          responseMes.json().catch(() => null),
          responseSolicitacoes.json().catch(() => null),
        ])
        if (!responseMes.ok || !Array.isArray(dadosMes?.bolsistas)) {
          throw new Error(mensagemDeErro(dadosMes, 'Não foi possível carregar as frequências.'))
        }
        if (!responseSolicitacoes.ok || !Array.isArray(dadosSolicitacoes)) {
          throw new Error(
            mensagemDeErro(dadosSolicitacoes, 'Não foi possível carregar as solicitações.')
          )
        }
        if (ativo) {
          setLinhas(dadosMes.bolsistas)
          setSolicitacoes(dadosSolicitacoes)
          setErro('')
        }
      } catch (error) {
        if (ativo) setErro(error.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    if (mes) carregar()
    return () => {
      ativo = false
    }
  }, [mes, versao])

  async function decidirPagamento(frequencia, autorizar, justificativa = '') {
    const response = await frequenciasFetch(`/${frequencia.id}/pagamento/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autorizar, justificativa }),
    })
    const dados = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(mensagemDeErro(dados, 'Não foi possível registrar a decisão do pagamento.'))
    }
    setVersao((atual) => atual + 1)
  }

  function autorizar(linha) {
    confirmar({
      title: 'Autorizar pagamento?',
      message: `O pagamento de ${linha.aluno_nome} referente a ${formatarMes(linha.mes_referencia)} será autorizado. A decisão não pode ser alterada depois.`,
      confirmLabel: 'Autorizar',
      tone: 'accent',
      onConfirm: async () => {
        await decidirPagamento(linha.frequencia, true)
        toast({ message: 'Pagamento autorizado.', tone: 'success' })
      },
    })
  }

  async function marcarComoLida(solicitacao) {
    const response = await frequenciasFetch(`/solicitacoes/${solicitacao.id}/ciencia/`, {
      method: 'POST',
    })
    if (!response.ok) {
      toast({ message: 'Não foi possível registrar a ciência.', tone: 'error' })
      return
    }
    setVersao((atual) => atual + 1)
  }

  async function exportar() {
    setExportando(true)
    try {
      const response = await frequenciasFetch('/exportar/')
      if (!response.ok) throw new Error('Não foi possível exportar o acompanhamento.')

      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `acompanhamento-${new Date().toISOString().slice(0, 10)}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast({ message: error.message, tone: 'error' })
    } finally {
      setExportando(false)
    }
  }

  function acoesDaLinha(linha) {
    const { frequencia } = linha
    const acoes = []
    if (linha.pode_lancar) {
      acoes.push({
        label: frequencia ? 'Corrigir frequência' : 'Lançar frequência',
        variant: frequencia ? 'outline' : 'accent',
        onClick: () => setLancando(linha),
      })
    }
    if (frequencia?.status_pagamento === 'PENDENTE' && linha.pode_lancar) {
      if (frequencia.registrada) {
        acoes.push({
          label: 'Autorizar pagamento',
          variant: 'accent',
          onClick: () => autorizar(linha),
        })
      }
      acoes.push({ label: 'Negar pagamento', variant: 'danger', onClick: () => setNegando(linha) })
    }
    return acoes
  }

  const linhasTabela = linhas.map((linha) => [
    <div key="aluno" className="text-left">
      <p className="font-medium text-gray-900">{linha.aluno_nome}</p>
      <p className="text-xs text-gray-400">{linha.aluno_email}</p>
      {linha.status_vinculo === 'DESLIGADO' && <Badge status="DESLIGADO" />}
    </div>,
    <div key="projeto" className="text-left">
      <p>{linha.projeto_titulo}</p>
      <p className="text-xs text-gray-400">
        {linha.edital_ano_codigo} · {linha.bolsa_tipo_display}
      </p>
    </div>,
    linha.prazo ? formatarData(linha.prazo) : 'Sem prazo',
    <SituacaoFrequencia key="frequencia" linha={linha} />,
    <SituacaoPagamento key="pagamento" frequencia={linha.frequencia} />,
    <AcoesCell key="acoes" acoes={acoesDaLinha(linha)} />,
  ])

  const linhasSolicitacoes = solicitacoes.map((solicitacao) => [
    <div key="aluno" className="text-left">
      <p className="font-medium text-gray-900">{solicitacao.aluno_nome}</p>
      <p className="text-xs text-gray-400">{solicitacao.projeto_titulo}</p>
    </div>,
    formatarMes(solicitacao.mes_referencia),
    <div key="solicitante" className="text-left">
      <p>{solicitacao.solicitante_nome}</p>
      <p className="text-xs text-gray-400">{formatarDataHora(solicitacao.criada_em)}</p>
    </div>,
    solicitacao.mensagem || '—',
    solicitacao.lida_em ? (
      <Badge key="lida" status="APROVADO" label="Lida" />
    ) : (
      <Badge key="lida" status="PENDENTE" label="Nova" />
    ),
    <AcoesCell
      key="acoes"
      acoes={[
        {
          label: 'Ir para o mês',
          variant: 'accent',
          onClick: () => setMes(solicitacao.mes_referencia),
        },
        ...(solicitacao.lida_em
          ? []
          : [
              {
                label: 'Marcar como lida',
                variant: 'outline',
                onClick: () => marcarComoLida(solicitacao),
              },
            ]),
      ]}
    />,
  ])

  const novas = solicitacoes.filter((solicitacao) => !solicitacao.lida_em).length

  return (
    <>
      <PageHeader
        title="Frequências"
        action={
          <Button variant="outline" size="sm" onClick={exportar} loading={exportando}>
            Exportar planilha de acompanhamento
          </Button>
        }
      />

      {erro && <Alert tone="error">{erro}</Alert>}

      {solicitacoes.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-3 text-base font-bold text-gray-900">
            Solicitações da Coordenação de Área
          </h2>
          {novas > 0 && (
            <Alert tone="warning">
              {novas === 1
                ? 'Há 1 nova solicitação de lançamento de frequência em atraso.'
                : `Há ${novas} novas solicitações de lançamento de frequência em atraso.`}
            </Alert>
          )}
          <DataTable
            columns={['Bolsista', 'Mês', 'Solicitado por', 'Mensagem', 'Situação', 'Ações']}
            rows={linhasSolicitacoes}
            porPagina={null}
          />
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <FormField label="Mês de referência" className="mb-0 min-w-[220px]">
          <TextInput
            type="month"
            value={mes}
            max={mesAtual()}
            onChange={(event) => setMes(event.target.value)}
          />
        </FormField>
        <p className="pb-2.5 text-sm text-gray-500">
          Lançamentos após o prazo do edital ficam sinalizados como fora do prazo.
        </p>
      </div>

      <DataTable
        columns={['Bolsista', 'Projeto', 'Prazo', 'Frequência', 'Pagamento', 'Ações']}
        rows={linhasTabela}
        loading={carregando}
        emptyMessage="Nenhum bolsista dos seus projetos neste mês."
      />

      {lancando && (
        <FrequenciaModal
          linha={lancando}
          onFechar={() => setLancando(null)}
          onLancada={(frequencia) => {
            setLancando(null)
            toast({
              message: frequencia.fora_do_prazo
                ? 'Frequência lançada fora do prazo do edital.'
                : 'Frequência lançada.',
              tone: 'success',
            })
            setVersao((atual) => atual + 1)
          }}
        />
      )}

      {negando && (
        <MotivoModal
          title="Negar pagamento"
          description={`O pagamento de ${negando.aluno_nome} referente a ${formatarMes(negando.mes_referencia)} será negado. A decisão não pode ser alterada depois.`}
          label="Justificativa"
          confirmLabel="Negar pagamento"
          onClose={() => setNegando(null)}
          onConfirm={async (justificativa) => {
            await decidirPagamento(negando.frequencia, false, justificativa)
            setNegando(null)
            toast({ message: 'Pagamento negado.', tone: 'success' })
          }}
        />
      )}
    </>
  )
}
