import { useEffect, useState } from 'react'
import { Badge, Button, DataTable, FormField, PageHeader, Select, useToast } from '../components'
import { getFrequencias, lancarFrequencia } from '../api'

const STATUS_COR = {
  INFORMADA: 'green',
  NAO_INFORMADA: 'red',
  PENDENTE: 'gray',
}

const STATUS_LABEL = {
  INFORMADA: 'Informada',
  NAO_INFORMADA: 'Não Informado',
  PENDENTE: 'Pendente',
}

function mesAtualISO() {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  return `${ano}-${mes}`
}

const COLUNAS = ['Bolsista', 'Prazo', 'Mês/Ano', 'Status', 'Lançado em', '']

export default function FrequenciaPage() {
  const { showToast } = useToast()
  const [frequencias, setFrequencias] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(null)
  const [filtroMes, setFiltroMes] = useState(mesAtualISO())

  useEffect(() => {
    const mes = filtroMes || undefined
    getFrequencias({ mes })
      .then((res) => {
        if (!res.ok) throw new Error('Erro ao carregar frequências.')
        return res.json()
      })
      .then((dados) => setFrequencias(Array.isArray(dados) ? dados : []))
      .catch(() => showToast('Erro ao carregar frequências.', 'error'))
      .finally(() => setCarregando(false))
  }, [filtroMes])

  function handleFiltroMes(valor) {
    setFiltroMes(valor)
    setCarregando(true)
  }

  async function handleLancar(freq) {
    setProcessando(freq.vinculo)
    try {
      const response = await lancarFrequencia(freq.vinculo, freq.mes_referencia)
      const dados = await response.json().catch(() => null)
      if (!response.ok) throw new Error(dados?.detail || 'Não foi possível lançar a frequência.')
      setFrequencias((atual) =>
        atual.map((freq_atual) =>
          freq_atual.vinculo === freq.vinculo && freq_atual.mes_referencia === freq.mes_referencia
            ? dados
            : freq_atual
        )
      )
      showToast('Frequência lançada com sucesso.', 'success')
    } catch (error) {
      showToast(error.message || 'Erro ao lançar frequência.', 'error')
    } finally {
      setProcessando(null)
    }
  }

  // Gerar opções de mês: 6 meses passados + mês atual + 1 futuro
  const opcoesMs = (() => {
    const opcoes = []
    const hoje = new Date()
    for (let delta = -5; delta <= 1; delta++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + delta, 1)
      const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      opcoes.push({ value: valor, label: label.charAt(0).toUpperCase() + label.slice(1) })
    }
    return [{ value: '', label: 'Todos os meses' }, ...opcoes.reverse()]
  })()

  const linhas = frequencias.map((freq) => [
    freq.aluno_nome || `Vínculo #${freq.vinculo}`,
    freq.dia_limite ? `Dia ${freq.dia_limite}` : '—',
    freq.mes_referencia
      ? new Date(freq.mes_referencia + 'T00:00:00').toLocaleDateString('pt-BR', {
          month: 'long',
          year: 'numeric',
        })
      : '—',
    <Badge key="status" variant={STATUS_COR[freq.status] || 'gray'}>
      {STATUS_LABEL[freq.status] || freq.status}
    </Badge>,
    freq.lancada_em
      ? new Date(freq.lancada_em).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : '—',
    freq.status === 'PENDENTE' || freq.status === 'NAO_INFORMADA' ? (
      <Button
        key="lancar"
        size="sm"
        disabled={processando === freq.vinculo}
        onClick={() => handleLancar(freq)}
      >
        Lançar
      </Button>
    ) : null,
  ])

  return (
    <>
      <PageHeader title="Frequência Mensal" />

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <FormField label="Mês de referência" style={{ flex: '0 0 220px' }}>
          <Select value={filtroMes} options={opcoesMs} onChange={handleFiltroMes} />
        </FormField>
      </div>

      <DataTable
        columns={COLUNAS}
        rows={linhas}
        loading={carregando}
        emptyMessage="Nenhuma frequência encontrada."
      />
    </>
  )
}
