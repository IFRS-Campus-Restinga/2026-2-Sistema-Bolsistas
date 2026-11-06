import { useState } from 'react'
import { Alert, Button, FileField, FormActions, FormField, Modal } from '../components'
import { bolsistasFetch } from '../api'
import { mensagemDeErro } from '../utils/mensagemDeErro'

export default function TermoAssinadoModal({ vinculo, final = false, onFechar, onEnviado }) {
  const [arquivo, setArquivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function enviar(event) {
    event.preventDefault()
    if (!arquivo) return
    setEnviando(true)
    setErro('')
    try {
      const form = new FormData()
      form.append('arquivo', arquivo)
      const response = await bolsistasFetch(`/vinculos/${vinculo.id}/termo/assinado/`, {
        method: 'POST',
        body: form,
      })
      const dados = await response.json().catch(() => null)
      if (!response.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível enviar o termo.'))
      onEnviado()
    } catch (error) {
      setErro(error.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      title={final ? 'Enviar Termo de Compromisso final' : 'Enviar minha assinatura'}
      onClose={onFechar}
      width={520}
    >
      <form onSubmit={enviar}>
        <p className="mb-4 text-sm text-gray-500">
          {final
            ? 'Depois de revisar a assinatura do aluno, envie o PDF também assinado pelo coordenador. Este envio ativará o vínculo.'
            : 'Envie o DOCX com a assinatura do estudante ou responsável legal. O vínculo será ativado somente depois da revisão e assinatura do coordenador.'}
        </p>
        {erro && <Alert tone="error">{erro}</Alert>}
        <FormField label={final ? 'Termo final assinado em PDF' : 'Termo assinado em DOCX'}>
          <FileField
            value={arquivo?.name || ''}
            onChange={setArquivo}
            accept={final ? '.pdf' : '.docx'}
          />
        </FormField>
        <p className="mb-4 text-xs text-gray-400">
          Somente {final ? 'PDF' : 'DOCX'}, com até 10 MB.
        </p>
        <FormActions>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" variant="accent" disabled={!arquivo} loading={enviando}>
            {final ? 'Enviar termo final' : 'Enviar minha assinatura'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  )
}
