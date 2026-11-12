import { useState } from 'react'
import { bolsistasFetch } from '../api'
import {
  Alert,
  Button,
  Drawer,
  FileField,
  FormField,
  IconDownload,
  IconFileText,
  TextArea,
  useToast,
} from '../components'
import { formatarDataHora } from '../utils/dataHora'
import { mensagemDeErro } from '../utils/mensagemDeErro'

/**
 * Revisão do termo que o aluno assinou: o coordenador envia o termo final em PDF, que efetiva
 * o vínculo, ou recusa a assinatura com o motivo para o aluno enviar outra.
 */
export default function RevisarTermoDrawer({ vinculo, onFechar, onConcluido }) {
  const toast = useToast()
  const termo = vinculo.termo
  const [arquivo, setArquivo] = useState(null)
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [acao, setAcao] = useState('')
  const [erro, setErro] = useState('')

  async function enviar(tipo, caminho, opcoes, sucesso) {
    setAcao(tipo)
    setErro('')
    try {
      const response = await bolsistasFetch(`/vinculos/${vinculo.id}/termo/${caminho}/`, {
        method: 'POST',
        ...opcoes,
      })
      const dados = await response.json().catch(() => null)
      if (!response.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível concluir.'))
      toast({ message: sucesso, tone: 'success' })
      onConcluido()
    } catch (error) {
      setErro(error.message)
    } finally {
      setAcao('')
    }
  }

  function enviarTermoFinal() {
    const body = new FormData()
    body.append('arquivo', arquivo)
    enviar('final', 'assinado', { body }, 'Termo final enviado e vínculo efetivado.')
  }

  function recusar() {
    enviar(
      'recusar',
      'recusar',
      { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }) },
      'Termo recusado. O aluno foi avisado.'
    )
  }

  const ocupado = Boolean(acao)
  const rodape = recusando ? (
    <>
      <Button disabled={ocupado} onClick={() => setRecusando(false)}>
        Voltar
      </Button>
      <Button
        variant="danger"
        disabled={ocupado || !motivo.trim()}
        loading={acao === 'recusar'}
        onClick={recusar}
      >
        Recusar termo
      </Button>
    </>
  ) : (
    <>
      <Button variant="outline" disabled={ocupado} onClick={() => setRecusando(true)}>
        Recusar
      </Button>
      <Button
        variant="accent"
        disabled={ocupado || !arquivo}
        loading={acao === 'final'}
        title={arquivo ? '' : 'Anexe o termo final assinado em PDF'}
        onClick={enviarTermoFinal}
      >
        Enviar termo final
      </Button>
    </>
  )

  return (
    <Drawer
      title={vinculo.aluno_nome}
      subtitle={`${vinculo.projeto_titulo} · Termo de compromisso`}
      onClose={onFechar}
      footer={rodape}
    >
      <div className="flex flex-col gap-6 p-5">
        {erro && <Alert tone="error">{erro}</Alert>}

        <section>
          <h4 className="mb-2 text-sm font-semibold text-gray-900">Termo assinado pelo aluno</h4>
          <a
            href={termo.arquivo_assinado_aluno_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-2.5 rounded-controle border border-gray-200 px-3 py-2 text-left no-underline hover:bg-gray-50"
          >
            <IconFileText size={16} className="text-gray-400" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-gray-900">
                {termo.nome_original_assinado_aluno || 'termo assinado'}
              </span>
              <span className="block text-xs text-gray-500">
                {termo.tipo_display} · enviado em {formatarDataHora(termo.enviado_aluno_em)}
              </span>
            </span>
            <IconDownload size={15} className="text-gray-400" />
          </a>
        </section>

        {recusando ? (
          <FormField label="Motivo da recusa" className="mb-0">
            <TextArea
              rows={4}
              autoFocus
              value={motivo}
              placeholder="Explique o que o aluno precisa corrigir no termo."
              onChange={(event) => setMotivo(event.target.value)}
            />
          </FormField>
        ) : (
          <FormField label="Termo final assinado pelo coordenador" className="mb-0">
            <FileField
              value={arquivo?.name || ''}
              onChange={setArquivo}
              accept=".pdf"
              disabled={ocupado}
            />
            <p className="text-xs text-gray-500">
              Somente PDF, com até 10 MB. O envio efetiva o vínculo do aluno.
            </p>
          </FormField>
        )}
      </div>
    </Drawer>
  )
}
