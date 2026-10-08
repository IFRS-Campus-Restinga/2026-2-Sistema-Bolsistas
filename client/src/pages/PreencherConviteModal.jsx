import { useRef, useState } from 'react'
import { vinculoDiretoFetch } from '../api'
import {
  Alert,
  Button,
  FileField,
  FormActions,
  FormField,
  IconPlus,
  Modal,
  TextInput,
  useConfirm,
  useToast,
} from '../components'

const MAX_DOCUMENTOS_ADICIONAIS = 5

function extrairErro(corpo, mensagemPadrao) {
  if (!corpo) return mensagemPadrao
  return (
    corpo.detail ||
    corpo.arquivo?.[0] ||
    corpo.tipo?.[0] ||
    corpo.non_field_errors?.[0] ||
    mensagemPadrao
  )
}

export default function PreencherConviteModal({ convite, onFechar, onAtualizado, onEnviado }) {
  const confirmar = useConfirm()
  const toast = useToast()
  const jaEnviado = convite.status === 'ENVIADO'

  const [termosAceitos, setTermosAceitos] = useState(convite.termos_aceitos)
  const [linkLattes, setLinkLattes] = useState(convite.link_lattes || '')
  const linkLattesOriginal = useRef(convite.link_lattes || '')
  const [historico, setHistorico] = useState(
    convite.documentos.find((d) => d.tipo === 'HISTORICO_ESCOLAR') ?? null
  )
  const [matricula, setMatricula] = useState(
    convite.documentos.find((d) => d.tipo === 'COMPROVANTE_MATRICULA') ?? null
  )
  const [adicionais, setAdicionais] = useState(
    convite.documentos
      .filter((d) => d.tipo === 'ADICIONAL')
      .map((d) => ({ key: crypto.randomUUID(), documento: d }))
  )
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')

  async function enviarDocumento(tipo, arquivo) {
    const formData = new FormData()
    formData.append('tipo', tipo)
    formData.append('arquivo', arquivo)
    const res = await vinculoDiretoFetch(`/convites/${convite.id}/documentos/`, {
      method: 'POST',
      body: formData,
    })
    const corpo = await res.json().catch(() => null)
    if (!res.ok) throw new Error(extrairErro(corpo, 'Erro ao enviar arquivo.'))
    return corpo
  }

  async function removerDocumentoRemoto(documentoId) {
    await vinculoDiretoFetch(`/documentos/${documentoId}/`, { method: 'DELETE' })
  }

  async function selecionarHistorico(arquivo) {
    setProcessando(true)
    setErro('')
    try {
      if (!arquivo) {
        if (historico) await removerDocumentoRemoto(historico.id)
        setHistorico(null)
        return
      }
      setHistorico(await enviarDocumento('HISTORICO_ESCOLAR', arquivo))
    } catch (err) {
      setErro(err.message)
    } finally {
      setProcessando(false)
    }
  }

  async function selecionarMatricula(arquivo) {
    setProcessando(true)
    setErro('')
    try {
      if (!arquivo) {
        if (matricula) await removerDocumentoRemoto(matricula.id)
        setMatricula(null)
        return
      }
      setMatricula(await enviarDocumento('COMPROVANTE_MATRICULA', arquivo))
    } catch (err) {
      setErro(err.message)
    } finally {
      setProcessando(false)
    }
  }

  function adicionarSlotExtra() {
    setAdicionais((atuais) => [...atuais, { key: crypto.randomUUID(), documento: null }])
  }

  async function selecionarAdicional(slotKey, arquivo) {
    setProcessando(true)
    setErro('')
    try {
      if (!arquivo) {
        const slot = adicionais.find((item) => item.key === slotKey)
        if (slot?.documento) await removerDocumentoRemoto(slot.documento.id)
        setAdicionais((atuais) =>
          atuais.map((item) => (item.key === slotKey ? { ...item, documento: null } : item))
        )
        return
      }
      const doc = await enviarDocumento('ADICIONAL', arquivo)
      setAdicionais((atuais) =>
        atuais.map((slot) => (slot.key === slotKey ? { ...slot, documento: doc } : slot))
      )
    } catch (err) {
      setErro(err.message)
    } finally {
      setProcessando(false)
    }
  }

  async function removerSlotExtra(slot) {
    if (slot.documento) {
      setProcessando(true)
      try {
        await removerDocumentoRemoto(slot.documento.id)
      } catch {
        // segue removendo da lista local mesmo se a chamada falhar
      } finally {
        setProcessando(false)
      }
    }
    setAdicionais((atuais) => atuais.filter((item) => item.key !== slot.key))
  }

  async function salvar(mensagemSucesso) {
    setProcessando(true)
    setErro('')
    try {
      const res = await vinculoDiretoFetch(`/convites/${convite.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termos_aceitos: termosAceitos, link_lattes: linkLattes }),
      })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extrairErro(corpo, 'Não foi possível salvar.'))
      linkLattesOriginal.current = linkLattes
      onAtualizado(corpo)
      if (mensagemSucesso) toast({ message: mensagemSucesso, tone: 'success' })
      return true
    } catch (e) {
      setErro(e.message)
      return false
    } finally {
      setProcessando(false)
    }
  }

  async function salvarEFechar() {
    const mensagem = jaEnviado
      ? 'Alterações salvas. O coordenador verá a versão mais recente.'
      : 'Alterações salvas. Continue depois em Convites.'
    if (await salvar(mensagem)) onFechar()
  }

  async function enviar() {
    if (!historico || !matricula) {
      setErro('Anexe o Histórico Escolar e o Comprovante de Matrícula antes de enviar.')
      return
    }
    if (!(await salvar(null))) return
    setProcessando(true)
    setErro('')
    try {
      const res = await vinculoDiretoFetch(`/convites/${convite.id}/enviar/`, { method: 'POST' })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extrairErro(corpo, 'Não foi possível enviar a documentação.'))
      toast({ message: 'Documentação enviada com sucesso.', tone: 'success' })
      onEnviado(corpo)
    } catch (e) {
      setErro(e.message)
    } finally {
      setProcessando(false)
    }
  }

  function pedirConfirmacaoEnvio() {
    confirmar({
      title: 'Enviar documentação',
      message:
        'Depois de enviada, a documentação fica com o Coordenador de Projeto para análise. Deseja confirmar?',
      confirmLabel: 'Enviar',
      tone: 'accent',
      onConfirm: enviar,
    })
  }

  function fechar() {
    if (linkLattes !== linkLattesOriginal.current) {
      confirmar({
        title: 'Fechar sem salvar?',
        message: 'Você tem alterações não salvas. Deseja fechar mesmo assim?',
        confirmLabel: 'Fechar sem salvar',
        tone: 'danger',
        onConfirm: onFechar,
      })
      return
    }
    onFechar()
  }

  const podeAdicionarExtra = adicionais.length < MAX_DOCUMENTOS_ADICIONAIS

  return (
    <Modal
      title={
        jaEnviado
          ? `Editar documentação: ${convite.projeto_titulo}`
          : `Convite: ${convite.projeto_titulo}`
      }
      onClose={fechar}
      width={600}
    >
      {erro && <Alert tone="error">{erro}</Alert>}
      {jaEnviado && (
        <Alert tone="success">
          Documentação já enviada ao coordenador. Você ainda pode editar enquanto ela não for
          aprovada.
        </Alert>
      )}
      {convite.justificativa_rejeicao && (
        <Alert tone="warning">
          O coordenador solicitou reenvio: {convite.justificativa_rejeicao}
        </Alert>
      )}

      <FormField label="Histórico Escolar (obrigatório)">
        <FileField
          value={historico?.nome_original || ''}
          onChange={selecionarHistorico}
          disabled={processando}
        />
      </FormField>

      <FormField label="Comprovante de Matrícula (obrigatório)">
        <FileField
          value={matricula?.nome_original || ''}
          onChange={selecionarMatricula}
          disabled={processando}
        />
      </FormField>

      <FormField label="Link do Lattes (opcional)">
        <TextInput
          type="url"
          placeholder="http://lattes.cnpq.br/..."
          value={linkLattes}
          onChange={(e) => setLinkLattes(e.target.value)}
        />
      </FormField>

      <FormField label="Documentos adicionais (opcional, até 5)">
        {adicionais.map((slot) => (
          <div
            key={slot.key}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
          >
            <div style={{ flex: 1 }}>
              <FileField
                value={slot.documento?.nome_original || ''}
                onChange={(arquivo) => selecionarAdicional(slot.key, arquivo)}
                disabled={processando || !!slot.documento}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => removerSlotExtra(slot)}
              disabled={processando}
            >
              Remover
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={adicionarSlotExtra}
          disabled={processando || !podeAdicionarExtra}
        >
          <IconPlus /> Adicionar documento
        </Button>
      </FormField>

      <p style={{ fontSize: 14, marginTop: 8 }}>
        Antes de enviar, leia com atenção o edital{' '}
        {convite.edital_link_documento_oficial ? (
          <a href={convite.edital_link_documento_oficial} target="_blank" rel="noopener noreferrer">
            <strong>{convite.edital_nome}</strong>
          </a>
        ) : (
          <strong>{convite.edital_nome}</strong>
        )}
        , que define prazos, critérios de avaliação e regras do processo.
      </p>

      <label
        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, marginTop: 8 }}
      >
        <input
          type="checkbox"
          checked={termosAceitos}
          onChange={(e) => setTermosAceitos(e.target.checked)}
        />
        Li e estou de acordo com os termos e o cronograma do edital desta bolsa.
      </label>

      <FormActions>
        <Button variant="danger" onClick={fechar} disabled={processando}>
          Fechar
        </Button>
        {jaEnviado ? (
          <Button variant="accent" onClick={salvarEFechar} disabled={processando}>
            {processando ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={salvarEFechar} disabled={processando}>
              Salvar
            </Button>
            <Button
              variant="accent"
              onClick={pedirConfirmacaoEnvio}
              disabled={processando || !termosAceitos}
            >
              {processando ? 'Enviando...' : 'Enviar Documentação'}
            </Button>
          </>
        )}
      </FormActions>
    </Modal>
  )
}
