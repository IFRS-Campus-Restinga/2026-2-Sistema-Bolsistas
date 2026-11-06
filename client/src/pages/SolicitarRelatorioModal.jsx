import { useState } from 'react'
import { bolsistasFetch } from '../api'
import { Alert, Button, FileField, FormActions, FormField, Modal, useToast } from '../components'
import { formatarData } from '../utils/dataHora'
import { mensagemDeErro } from '../utils/mensagemDeErro'

export default function SolicitarRelatorioModal({ vinculo, onFechar, onSolicitado }) {
  const toast = useToast()
  const [modelo, setModelo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function solicitar() {
    setEnviando(true)
    setErro('')
    try {
      const body = new FormData()
      if (modelo) body.append('modelo', modelo)
      const response = await bolsistasFetch(`/vinculos/${vinculo.id}/solicitar-relatorio/`, {
        method: 'POST',
        body,
      })
      const dados = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(mensagemDeErro(dados, 'Não foi possível solicitar o relatório.'))
      }
      toast({ message: 'Relatório final solicitado.', tone: 'success' })
      onSolicitado()
    } catch (error) {
      setErro(error.message)
    } finally {
      setEnviando(false)
    }
  }

  function fechar() {
    if (!enviando) onFechar()
  }

  return (
    <Modal title="Solicitar relatório final" onClose={fechar} width={520}>
      <p className="mb-4 text-sm text-gray-600">
        {vinculo.prazo_relatorio_encerrado
          ? `O prazo do edital terminou em ${formatarData(vinculo.prazo_relatorio)}. ${vinculo.aluno_nome} ainda poderá enviar o relatório, que ficará marcado como entregue fora do prazo para a coordenação de área.`
          : `${vinculo.aluno_nome} poderá enviar o relatório final até ${formatarData(vinculo.prazo_relatorio)}, prazo definido no edital.`}
      </p>

      {erro && <Alert tone="error">{erro}</Alert>}

      <FormField label="Modelo de relatório (opcional)">
        <FileField
          value={modelo?.name || ''}
          onChange={setModelo}
          accept=".pdf,.doc,.docx,.odt"
          disabled={enviando}
        />
      </FormField>
      <p className="-mt-2 mb-4 text-xs text-gray-400">
        PDF, DOC, DOCX ou ODT, com até 10 MB. O bolsista poderá baixá-lo em Minha bolsa.
      </p>

      <FormActions>
        <Button variant="outline" onClick={fechar} disabled={enviando}>
          Cancelar
        </Button>
        <Button variant="accent" onClick={solicitar} loading={enviando}>
          Solicitar relatório
        </Button>
      </FormActions>
    </Modal>
  )
}
