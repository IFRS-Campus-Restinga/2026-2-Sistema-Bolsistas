import { useState } from 'react'
import { Alert, Button, FormActions, FormField, Modal, TextArea } from '../components'

export default function MotivoModal({
  title,
  description,
  label = 'Motivo',
  confirmLabel,
  tone = 'danger',
  onClose,
  onConfirm,
}) {
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(event) {
    event.preventDefault()
    if (!motivo.trim()) {
      setErro(`Informe o ${label.toLowerCase()}.`)
      return
    }

    setEnviando(true)
    setErro('')
    try {
      await onConfirm(motivo.trim())
    } catch (error) {
      setErro(error.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose} width={520}>
      {description && <p className="mb-4 text-sm text-gray-600">{description}</p>}
      {erro && <Alert tone="error">{erro}</Alert>}

      <form onSubmit={enviar}>
        <FormField label={label}>
          <TextArea
            rows={5}
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            maxLength={5000}
            disabled={enviando}
          />
        </FormField>
        <FormActions>
          <Button onClick={onClose} disabled={enviando}>
            Fechar
          </Button>
          <Button type="submit" variant={tone} loading={enviando}>
            {confirmLabel}
          </Button>
        </FormActions>
      </form>
    </Modal>
  )
}
