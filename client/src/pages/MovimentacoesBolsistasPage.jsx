import { useEffect, useState } from 'react'
import { bolsistasFetch } from '../api'
import { AcoesCell, Alert, Badge, DataTable, PageHeader, useToast } from '../components'
import { formatarDataHora } from '../utils/dataHora'
import { mensagemDeErro } from '../utils/mensagemDeErro'

export default function MovimentacoesBolsistasPage() {
  const toast = useToast()
  const [desligamentos, setDesligamentos] = useState([])
  const [cancelamentos, setCancelamentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setCarregando(true)
      try {
        const [responseDesligamentos, responseCancelamentos] = await Promise.all([
          bolsistasFetch('/area/desligamentos/'),
          bolsistasFetch('/area/cancelamentos/'),
        ])
        const [dadosDesligamentos, dadosCancelamentos] = await Promise.all([
          responseDesligamentos.json().catch(() => null),
          responseCancelamentos.json().catch(() => null),
        ])
        if (!responseDesligamentos.ok || !Array.isArray(dadosDesligamentos)) {
          throw new Error(
            mensagemDeErro(dadosDesligamentos, 'Não foi possível carregar os desligamentos.')
          )
        }
        if (!responseCancelamentos.ok || !Array.isArray(dadosCancelamentos)) {
          throw new Error(
            mensagemDeErro(dadosCancelamentos, 'Não foi possível carregar os cancelamentos.')
          )
        }
        if (ativo) {
          setDesligamentos(dadosDesligamentos)
          setCancelamentos(dadosCancelamentos)
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

  async function tomarCiencia(tipo, id) {
    const response = await bolsistasFetch(`/area/${tipo}/${id}/ciencia/`, { method: 'POST' })
    const dados = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(mensagemDeErro(dados, 'Não foi possível registrar a ciência.'))
    }
    toast({ message: 'Ciência registrada.', tone: 'success' })
    setVersao((atual) => atual + 1)
  }

  function acaoCiencia(tipo, item) {
    if (item.ciencia_area_em) {
      return (
        <span className="text-xs text-gray-500">
          Ciente em {formatarDataHora(item.ciencia_area_em)}
        </span>
      )
    }
    return (
      <AcoesCell
        acoes={[
          {
            label: 'Tomar ciência',
            variant: 'accent',
            onClick: () => tomarCiencia(tipo, item.id),
          },
        ]}
      />
    )
  }

  const linhasDesligamentos = desligamentos.map((item) => [
    item.aluno_nome,
    item.projeto_titulo,
    item.origem_display,
    item.motivo,
    <Badge key="status" status={item.status} />,
    formatarDataHora(item.decidida_em),
    <div key="acao">{acaoCiencia('desligamentos', item)}</div>,
  ])

  const linhasCancelamentos = cancelamentos.map((item) => [
    item.aluno_nome,
    item.projeto_titulo,
    item.justificativa,
    formatarDataHora(item.cancelada_em),
    <div key="acao">{acaoCiencia('cancelamentos', item)}</div>,
  ])

  return (
    <>
      <PageHeader title="Desligamentos e Cancelamentos" />
      {erro && <Alert tone="error">{erro}</Alert>}

      <section className="mb-8">
        <h2 className="mb-3 text-base font-bold text-gray-900">Desligamentos recentes</h2>
        <DataTable
          columns={['Bolsista', 'Projeto', 'Origem', 'Motivo', 'Status', 'Data', 'Ações']}
          rows={linhasDesligamentos}
          loading={carregando}
          emptyMessage="Nenhum desligamento registrado nas bolsas da sua área."
        />
      </section>

      <section>
        <h2 className="mb-3 text-base font-bold text-gray-900">Cancelamentos de vagas</h2>
        <DataTable
          columns={['Antigo bolsista', 'Projeto', 'Justificativa', 'Data', 'Ações']}
          rows={linhasCancelamentos}
          loading={carregando}
          emptyMessage="Nenhum cancelamento de vaga registrado nas bolsas da sua área."
        />
      </section>
    </>
  )
}
