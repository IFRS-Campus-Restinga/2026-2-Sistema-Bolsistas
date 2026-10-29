import { useState } from 'react'
import { frequenciasFetch } from '../api'
import { Alert, Button, FormActions, FormField, Modal, Select, TextArea } from '../components'
import { formatarData } from '../utils/dataHora'
import { formatarMes } from '../utils/mesReferencia'
import { mensagemDeErro } from '../utils/mensagemDeErro'

export default function FrequenciaModal({ linha, onFechar, onLancada }) {
  const { frequencia } = linha
  const [registrada, setRegistrada] = useState(frequencia ? String(frequencia.registrada) : 'true')
  const [observacoes, setObservacoes] = useState(frequencia?.observacoes ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function enviar(event) {
    event.preventDefault()
    if (registrada === 'false' && !observacoes.trim()) {
      setErro('Informe nas observações por que a frequência não foi registrada.')
      return
    }

    setSalvando(true)
    setErro('')
    try {
      const response = await frequenciasFetch('/lancamentos/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vinculo: linha.vinculo_id,
          mes_referencia: linha.mes_referencia,
          registrada: registrada === 'true',
          observacoes: observacoes.trim(),
        }),
      })
      const dados = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(mensagemDeErro(dados, 'Não foi possível lançar a frequência.'))
      }
      onLancada(dados)
    } catch (error) {
      setErro(error.message)
    } finally {
      setSalvando(false)
    }
  }

  function fechar() {
    if (!salvando) onFechar()
  }

  return (
    <Modal
      title={frequencia ? 'Corrigir frequência' : 'Lançar frequência'}
      onClose={fechar}
      width={520}
    >
      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="font-semibold text-gray-500">Bolsista</dt>
        <dd className="text-gray-800">{linha.aluno_nome}</dd>
        <dt className="font-semibold text-gray-500">Projeto</dt>
        <dd className="text-gray-800">{linha.projeto_titulo}</dd>
        <dt className="font-semibold text-gray-500">Mês</dt>
        <dd className="text-gray-800">{formatarMes(linha.mes_referencia)}</dd>
        <dt className="font-semibold text-gray-500">Prazo</dt>
        <dd className="text-gray-800">
          {linha.prazo ? formatarData(linha.prazo) : 'O edital não define prazo mensal.'}
        </dd>
      </dl>

      {!frequencia && linha.pendente && (
        <Alert tone="warning">
          O prazo do edital terminou em {formatarData(linha.prazo)}. O lançamento será sinalizado
          como fora do prazo.
        </Alert>
      )}
      {erro && <Alert tone="error">{erro}</Alert>}

      <form onSubmit={enviar}>
        <FormField label="Frequência do mês">
          <Select
            value={registrada}
            onChange={(event) => setRegistrada(event.target.value)}
            disabled={salvando}
          >
            <option value="true">Registrada (o bolsista cumpriu a frequência)</option>
            <option value="false">Não registrada (o bolsista não cumpriu a frequência)</option>
          </Select>
        </FormField>
        <FormField label={registrada === 'false' ? 'Observações' : 'Observações (opcional)'}>
          <TextArea
            rows={4}
            value={observacoes}
            onChange={(event) => setObservacoes(event.target.value)}
            maxLength={5000}
            disabled={salvando}
          />
        </FormField>
        <FormActions>
          <Button onClick={fechar} disabled={salvando}>
            Fechar
          </Button>
          <Button type="submit" variant="accent" loading={salvando}>
            {frequencia ? 'Salvar correção' : 'Lançar frequência'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  )
}
