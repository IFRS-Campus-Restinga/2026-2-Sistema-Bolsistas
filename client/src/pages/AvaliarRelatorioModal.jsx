import { useState } from 'react'
import { bolsistasFetch } from '../api'
import {
  Alert,
  Button,
  FormActions,
  FormField,
  Modal,
  TextArea,
  useConfirm,
  useToast,
} from '../components'
import { formatarDataHora } from '../utils/dataHora'
import { mensagemDeErro } from '../utils/mensagemDeErro'

export default function AvaliarRelatorioModal({ vinculo, onFechar, onAvaliado }) {
  const confirmar = useConfirm()
  const toast = useToast()
  const [reprovando, setReprovando] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const { relatorio } = vinculo

  async function registrarParecer(situacao) {
    const response = await bolsistasFetch(`/vinculos/${vinculo.id}/parecer/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ situacao, justificativa }),
    })
    const dados = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(mensagemDeErro(dados, 'Não foi possível registrar o parecer.'))
    }
  }

  function aprovar() {
    confirmar({
      title: 'Aprovar relatório final?',
      message: `O relatório de ${vinculo.aluno_nome} será aprovado e não poderá mais ser reenviado.`,
      confirmLabel: 'Aprovar',
      tone: 'accent',
      onConfirm: async () => {
        await registrarParecer('APROVADO')
        toast({ message: 'Relatório aprovado.', tone: 'success' })
        onAvaliado()
      },
    })
  }

  async function reprovar() {
    setSalvando(true)
    setErro('')
    try {
      await registrarParecer('REPROVADO')
      toast({ message: 'Relatório reprovado. O bolsista pode reenviar no prazo.', tone: 'success' })
      onAvaliado()
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
    <Modal title="Avaliar relatório final" onClose={fechar} width={560}>
      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="font-semibold text-gray-500">Bolsista</dt>
        <dd className="text-gray-800">{vinculo.aluno_nome}</dd>
        <dt className="font-semibold text-gray-500">Projeto</dt>
        <dd className="text-gray-800">{vinculo.projeto_titulo}</dd>
        <dt className="font-semibold text-gray-500">Edital</dt>
        <dd className="text-gray-800">
          {vinculo.edital_ano_codigo} · {vinculo.edital_nome}
        </dd>
        <dt className="font-semibold text-gray-500">Enviado em</dt>
        <dd className="text-gray-800">{formatarDataHora(relatorio.enviado_em)}</dd>
      </dl>

      <p className="mb-4">
        <a href={relatorio.arquivo} target="_blank" rel="noopener noreferrer">
          Abrir {relatorio.nome_original || 'relatório final'}
        </a>
      </p>

      {erro && <Alert tone="error">{erro}</Alert>}

      {reprovando && (
        <FormField label="Justificativa da reprovação (obrigatória)">
          <TextArea
            aria-label="Justificativa da reprovação"
            value={justificativa}
            onChange={(event) => setJustificativa(event.target.value)}
            maxLength={5000}
            rows={4}
            disabled={salvando}
            placeholder="Explique o que precisa ser corrigido no relatório."
          />
        </FormField>
      )}

      <FormActions>
        {reprovando ? (
          <>
            <Button variant="outline" onClick={() => setReprovando(false)} disabled={salvando}>
              Voltar
            </Button>
            <Button
              variant="danger"
              onClick={reprovar}
              disabled={!justificativa.trim()}
              loading={salvando}
            >
              Reprovar relatório
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={fechar}>
              Fechar
            </Button>
            <Button variant="danger" onClick={() => setReprovando(true)}>
              Reprovar
            </Button>
            <Button variant="accent" onClick={aprovar}>
              Aprovar
            </Button>
          </>
        )}
      </FormActions>
    </Modal>
  )
}
