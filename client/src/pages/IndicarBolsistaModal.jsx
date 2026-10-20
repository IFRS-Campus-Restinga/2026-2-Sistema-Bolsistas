import { useState } from 'react'
import { selecaoFetch } from '../api'
import { Alert, Badge, Button, FormActions, FormField, Modal, TextArea } from '../components'
import { mensagemDeErro } from '../utils/mensagemDeErro'

export default function IndicarBolsistaModal({ bolsaId, candidato, onSalvo, onFechar }) {
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const exigeJustificativa = candidato.exige_justificativa_indicacao

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      const res = await selecaoFetch(`/bolsas/${bolsaId}/indicacoes/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inscricao: candidato.inscricao, justificativa }),
      })
      const dados = await res.json().catch(() => null)
      if (!res.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível indicar o bolsista.'))
      onSalvo(dados)
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal title="Indicar bolsista" onClose={onFechar} width={520}>
      {erro && <Alert tone="error">{erro}</Alert>}
      <p style={{ marginBottom: 12 }}>
        <strong>{candidato.aluno_nome}</strong> ({candidato.posicao}º lugar, nota{' '}
        {candidato.nota_final}) <Badge status={candidato.situacao} />
      </p>
      <p style={{ marginBottom: 12 }}>
        A indicação formaliza o aluno como bolsista e inicia o vínculo administrativo com a bolsa.
      </p>

      {exigeJustificativa && (
        <Alert tone="warning">
          Há suplentes mais bem colocados disponíveis. Informe a justificativa para indicar este
          suplente fora da ordem; os suplentes pulados continuam disponíveis na lista.
        </Alert>
      )}

      <FormField
        label={exigeJustificativa ? 'Justificativa (obrigatória)' : 'Observação (opcional)'}
      >
        <TextArea
          rows={3}
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
        />
      </FormField>

      <FormActions>
        <Button variant="outline" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button
          variant="accent"
          onClick={salvar}
          disabled={exigeJustificativa && !justificativa.trim()}
          loading={salvando}
        >
          Confirmar indicação
        </Button>
      </FormActions>
    </Modal>
  )
}
