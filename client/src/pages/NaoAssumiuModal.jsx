import { useState } from 'react'
import { selecaoFetch } from '../api'
import { Alert, Badge, Button, FormActions, FormField, Modal, TextArea } from '../components'
import { mensagemDeErro } from '../utils/mensagemDeErro'

/**
 * Registra que um titular não vai assumir a vaga; a vaga fica livre para um suplente.
 */
export default function NaoAssumiuModal({ bolsaId, candidato, onSalvo, onFechar }) {
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      const res = await selecaoFetch(`/bolsas/${bolsaId}/desistencias/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inscricao: candidato.inscricao, motivo }),
      })
      const dados = await res.json().catch(() => null)
      if (!res.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível registrar.'))
      onSalvo(dados)
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal title="Titular não vai assumir" onClose={onFechar} width={520}>
      {erro && <Alert tone="error">{erro}</Alert>}
      <p style={{ marginBottom: 12 }}>
        <strong>{candidato.aluno_nome}</strong> ({candidato.posicao}º lugar, nota{' '}
        {candidato.nota_final}) <Badge status={candidato.situacao} />
      </p>
      <Alert tone="warning">
        A vaga deste titular ficará livre para ser ocupada por um suplente. Esta ação não pode ser
        desfeita e o aluno será notificado.
      </Alert>

      <FormField label="Motivo (obrigatório)">
        <TextArea
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: o aluno informou que aceitou outra bolsa."
        />
      </FormField>

      <FormActions>
        <Button variant="outline" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={salvar} disabled={salvando || !motivo.trim()}>
          {salvando ? 'Registrando...' : 'Confirmar'}
        </Button>
      </FormActions>
    </Modal>
  )
}
