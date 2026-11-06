import { useEffect, useState } from 'react'
import { frequenciasFetch } from '../api'
import { Alert, Badge, Carregando, DataTable, IconGradCap, PageHeader } from '../components'
import { formatarMes } from '../utils/mesReferencia'
import { mensagemDeErro } from '../utils/mensagemDeErro'

function Observacoes({ mes }) {
  if (!mes.observacoes && !mes.justificativa_pagamento) {
    return <span className="text-gray-300">—</span>
  }
  return (
    <div className="max-w-[360px] text-left text-sm text-gray-600">
      {mes.observacoes && <p>{mes.observacoes}</p>}
      {mes.justificativa_pagamento && (
        <p className="text-xs text-gray-500">Pagamento: {mes.justificativa_pagamento}</p>
      )}
    </div>
  )
}

function HistoricoDaBolsa({ item }) {
  const { relatorio } = item
  const linhas = item.meses.map((mes) => [
    formatarMes(mes.mes_referencia),
    <div key="frequencia" className="flex flex-col items-center gap-1">
      <Badge status={mes.status} />
      {mes.fora_do_prazo && <span className="text-xs text-amber-600">Lançada fora do prazo</span>}
    </div>,
    mes.status_pagamento ? (
      <Badge key="pagamento" status={mes.status_pagamento} />
    ) : (
      <span key="pagamento" className="text-gray-300">
        —
      </span>
    ),
    <Observacoes key="observacoes" mes={mes} />,
  ])

  return (
    <section className="mb-7 rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">{item.projeto_titulo}</h2>
          <p className="text-sm text-gray-500">
            {item.edital_ano_codigo} · {item.edital_nome} · Coordenador(a): {item.coordenador_nome}
          </p>
        </div>
        <Badge status={item.status_vinculo} />
      </div>

      {relatorio && (
        <p className="mb-4 text-sm text-gray-600">
          Relatório final: <Badge status={relatorio.situacao} />
          {relatorio.justificativa && (
            <span className="ml-2 text-gray-500">Parecer: {relatorio.justificativa}</span>
          )}
        </p>
      )}

      <DataTable
        columns={['Mês', 'Frequência', 'Pagamento', 'Observações e pareceres']}
        rows={linhas}
        emptyMessage="Ainda não há meses registrados nesta bolsa."
      />
    </section>
  )
}

export default function MinhaFrequenciaPage() {
  const [historico, setHistorico] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const response = await frequenciasFetch('/minhas/')
        const dados = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(dados)) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar sua frequência.'))
        }
        if (ativo) {
          setHistorico(dados)
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
  }, [])

  return (
    <>
      <PageHeader title="Minha Frequência" />

      {erro && <Alert tone="error">{erro}</Alert>}

      {carregando ? (
        <Carregando />
      ) : (
        !erro &&
        (historico.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
            <IconGradCap />
            <p>Você ainda não é bolsista de nenhum projeto.</p>
          </div>
        ) : (
          historico.map((item) => <HistoricoDaBolsa key={item.vinculo_id} item={item} />)
        ))
      )}
    </>
  )
}
