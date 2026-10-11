import { useState } from 'react'
import { selecaoFetch } from '../api'
import { Alert, Button, FormActions, FormField, Modal, TextInput } from '../components'
import { formatarPeso } from '../utils/formatarPeso'
import { mensagemDeErro } from '../utils/mensagemDeErro'

const NOTA_MAXIMA = 10

function notaValida(valor) {
  if (valor === '') return true
  const numero = Number(valor)
  return !Number.isNaN(numero) && numero >= 0 && numero <= NOTA_MAXIMA
}

// Mesma regra do backend: média ponderada pelos pesos efetivos das etapas.
function previaNotaFinal(etapas, notas) {
  if (etapas.some((etapa) => notas[etapa.id] === '' || !notaValida(notas[etapa.id]))) return null
  const pesos = etapas.map((etapa) => Number(etapa.peso_efetivo || 0))
  const total = pesos.reduce((soma, peso) => soma + peso, 0)
  const efetivos = total > 0 ? pesos : etapas.map(() => 1)
  const divisor = total > 0 ? total : etapas.length
  const soma = etapas.reduce((acc, etapa, i) => acc + Number(notas[etapa.id]) * efetivos[i], 0)
  return (soma / divisor).toFixed(2)
}

export default function LancarNotasModal({ bolsaId, candidato, etapas, onSalvo, onFechar }) {
  const [notas, setNotas] = useState(() =>
    Object.fromEntries(etapas.map((etapa) => [etapa.id, candidato.notas[etapa.id] ?? '']))
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const invalidas = etapas.filter((etapa) => !notaValida(notas[etapa.id]))
  const previa = previaNotaFinal(etapas, notas)
  const jaTinhaNotas = Object.keys(candidato.notas).length > 0

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      const res = await selecaoFetch(
        `/bolsas/${bolsaId}/inscricoes/${candidato.inscricao}/notas/`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notas: etapas.map((etapa) => ({
              etapa: etapa.id,
              nota: notas[etapa.id] === '' ? null : notas[etapa.id],
            })),
          }),
        }
      )
      const dados = await res.json().catch(() => null)
      if (!res.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível salvar as notas.'))
      onSalvo(dados)
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      title={`${jaTinhaNotas ? 'Editar' : 'Lançar'} notas: ${candidato.aluno_nome}`}
      onClose={onFechar}
      width={520}
    >
      {erro && <Alert tone="error">{erro}</Alert>}
      <p style={{ marginBottom: 12 }}>
        Informe uma nota de 0 a {NOTA_MAXIMA} para cada etapa. As notas podem ser corrigidas até a
        publicação do resultado.
      </p>

      {etapas.map((etapa) => (
        <FormField
          key={etapa.id}
          label={`${etapa.nome} (peso ${formatarPeso(etapa.peso_efetivo)})`}
        >
          <TextInput
            type="number"
            step="0.01"
            min="0"
            max={NOTA_MAXIMA}
            value={notas[etapa.id]}
            onChange={(e) => setNotas((atuais) => ({ ...atuais, [etapa.id]: e.target.value }))}
          />
        </FormField>
      ))}

      {invalidas.length > 0 && (
        <Alert tone="warning">As notas devem estar entre 0 e {NOTA_MAXIMA}.</Alert>
      )}
      <p style={{ marginTop: 8 }}>
        <strong>Nota final prevista:</strong> {previa ?? 'preencha todas as etapas para calcular'}
      </p>

      <FormActions>
        <Button variant="outline" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button variant="accent" onClick={salvar} disabled={salvando || invalidas.length > 0}>
          {salvando ? 'Salvando...' : 'Salvar notas'}
        </Button>
      </FormActions>
    </Modal>
  )
}
