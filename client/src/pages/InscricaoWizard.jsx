import { useRef, useState } from 'react'
import { inscricoesFetch } from '../api'
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
    corpo.bolsa?.[0] ||
    corpo.arquivo?.[0] ||
    corpo.tipo?.[0] ||
    corpo.non_field_errors?.[0] ||
    mensagemPadrao
  )
}

export default function InscricaoWizard({ bolsa, inscricaoExistente, onFechar, onConcluida }) {
  const confirmar = useConfirm()
  const toast = useToast()
  const modoEdicao = !!inscricaoExistente
  const jaEnviada = inscricaoExistente?.status === 'PENDENTE'

  const tituloProjeto = bolsa?.projeto_titulo ?? inscricaoExistente?.projeto_titulo
  const editalNome = bolsa?.edital_nome ?? inscricaoExistente?.edital_nome
  const editalLink = bolsa?.edital_link_documento_oficial

  const [etapa, setEtapa] = useState(modoEdicao ? 2 : 1)
  const [inscricaoId, setInscricaoId] = useState(inscricaoExistente?.id ?? null)
  const [termosAceitos, setTermosAceitos] = useState(inscricaoExistente?.termos_aceitos ?? false)
  const [linkLattes, setLinkLattes] = useState(inscricaoExistente?.link_lattes ?? '')
  const linkLattesOriginal = useRef(inscricaoExistente?.link_lattes ?? '')
  const [historico, setHistorico] = useState(
    inscricaoExistente?.documentos.find((d) => d.tipo === 'HISTORICO_ESCOLAR') ?? null
  )
  const [matricula, setMatricula] = useState(
    inscricaoExistente?.documentos.find((d) => d.tipo === 'COMPROVANTE_MATRICULA') ?? null
  )
  const [adicionais, setAdicionais] = useState(
    (inscricaoExistente?.documentos ?? [])
      .filter((d) => d.tipo === 'ADICIONAL')
      .map((d) => ({ key: crypto.randomUUID(), documento: d }))
  )
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')

  async function enviarDocumento(inscricao, tipo, arquivo) {
    const formData = new FormData()
    formData.append('tipo', tipo)
    formData.append('arquivo', arquivo)
    const res = await inscricoesFetch(`/${inscricao}/documentos/`, {
      method: 'POST',
      body: formData,
    })
    const corpo = await res.json().catch(() => null)
    if (!res.ok) throw new Error(extrairErro(corpo, 'Erro ao enviar arquivo.'))
    return corpo
  }

  async function removerDocumentoRemoto(documentoId) {
    await inscricoesFetch(`/documentos/${documentoId}/`, { method: 'DELETE' })
  }

  async function avancarEtapa1() {
    if (inscricaoId) {
      // Já criada (ex: usuário clicou Voltar e está avançando de novo) —
      // não recriar, senão a UniqueConstraint (aluno, bolsa) rejeita.
      setEtapa(2)
      return
    }
    setProcessando(true)
    setErro('')
    try {
      const res = await inscricoesFetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bolsa: bolsa.id, termos_aceitos: true }),
      })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extrairErro(corpo, 'Não foi possível iniciar a inscrição.'))
      setInscricaoId(corpo.id)
      setEtapa(2)
    } catch (e) {
      setErro(e.message)
    } finally {
      setProcessando(false)
    }
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
      const doc = await enviarDocumento(inscricaoId, 'HISTORICO_ESCOLAR', arquivo)
      setHistorico(doc)
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
      const doc = await enviarDocumento(inscricaoId, 'COMPROVANTE_MATRICULA', arquivo)
      setMatricula(doc)
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
      const doc = await enviarDocumento(inscricaoId, 'ADICIONAL', arquivo)
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

  async function avancarEtapa2() {
    if (!historico || !matricula) {
      setErro('Anexe o Histórico Escolar e o Comprovante de Matrícula antes de continuar.')
      return
    }
    setProcessando(true)
    setErro('')
    try {
      const res = await inscricoesFetch(`/${inscricaoId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_lattes: linkLattes }),
      })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extrairErro(corpo, 'Não foi possível salvar o link do Lattes.'))
      linkLattesOriginal.current = linkLattes
      setEtapa(3)
    } catch (e) {
      setErro(e.message)
    } finally {
      setProcessando(false)
    }
  }

  function pedirCancelamento() {
    // Editando uma inscrição já enviada: "Fechar" aqui é só sair do
    // formulário — cancelar a inscrição de verdade (status -> CANCELADA) é
    // uma ação separada, feita em Minhas Inscrições. Mas se tem o link do
    // Lattes editado e ainda não salvo, confirma antes de descartar.
    if (jaEnviada) {
      if (linkLattes === linkLattesOriginal.current) {
        onFechar()
        return
      }
      confirmar({
        title: 'Fechar sem salvar?',
        message: 'Você tem alterações não salvas (link do Lattes). Deseja fechar mesmo assim?',
        confirmLabel: 'Fechar sem salvar',
        tone: 'danger',
        onConfirm: onFechar,
      })
      return
    }

    confirmar({
      title: 'Cancelar inscrição',
      message: inscricaoId
        ? 'Tem certeza? Os dados preenchidos e os documentos anexados serão descartados.'
        : 'Tem certeza que deseja sair sem se inscrever?',
      confirmLabel: 'Cancelar inscrição',
      tone: 'danger',
      onConfirm: async () => {
        if (inscricaoId) {
          await inscricoesFetch(`/${inscricaoId}/`, { method: 'DELETE' }).catch(() => null)
        }
        onFechar()
      },
    })
  }

  function pedirConfirmacaoFinal() {
    confirmar({
      title: 'Confirmar inscrição',
      message:
        'Depois de confirmada, a inscrição fica com o Coordenador de Projeto para avaliação. Deseja confirmar?',
      confirmLabel: 'Confirmar Inscrição',
      tone: 'accent',
      onConfirm: enviarInscricao,
    })
  }

  async function salvarRascunho() {
    setProcessando(true)
    setErro('')
    try {
      const res = await inscricoesFetch(`/${inscricaoId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_lattes: linkLattes }),
      })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extrairErro(corpo, 'Não foi possível salvar.'))
      linkLattesOriginal.current = linkLattes
      toast({
        message: jaEnviada
          ? 'Alterações salvas.'
          : 'Rascunho salvo. Continue depois em Minhas Inscrições.',
        tone: 'success',
      })
      onFechar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setProcessando(false)
    }
  }

  async function enviarInscricao() {
    setProcessando(true)
    setErro('')
    try {
      const res = await inscricoesFetch(`/${inscricaoId}/enviar/`, { method: 'POST' })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extrairErro(corpo, 'Não foi possível enviar a inscrição.'))
      toast({ message: 'Inscrição enviada com sucesso.', tone: 'success' })
      onConcluida(corpo)
    } catch (e) {
      setErro(e.message)
    } finally {
      setProcessando(false)
    }
  }

  const podeAdicionarExtra = adicionais.length < MAX_DOCUMENTOS_ADICIONAIS

  return (
    <Modal title={`Inscrição: ${tituloProjeto}`} onClose={onFechar} width={600}>
      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: -8, marginBottom: 16 }}>
        Etapa {etapa} de 3
      </p>

      {erro && <Alert tone="error">{erro}</Alert>}

      {etapa === 1 && (
        <>
          <p style={{ marginBottom: 16 }}>
            Antes de se inscrever, leia com atenção o edital{' '}
            {editalLink ? (
              <a href={editalLink} target="_blank" rel="noopener noreferrer">
                <strong>{editalNome}</strong>
              </a>
            ) : (
              <strong>{editalNome}</strong>
            )}
            , que define prazos, critérios de avaliação e regras do processo seletivo.
          </p>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={termosAceitos}
              onChange={(e) => setTermosAceitos(e.target.checked)}
            />
            Li e estou de acordo com os termos e o cronograma deste edital.
          </label>

          <FormActions>
            <Button variant="outline" onClick={pedirCancelamento} disabled={processando}>
              Cancelar
            </Button>
            <Button
              variant="accent"
              onClick={avancarEtapa1}
              disabled={!termosAceitos || processando}
            >
              {processando ? 'Avançando...' : 'Avançar'}
            </Button>
          </FormActions>
        </>
      )}

      {etapa === 2 && (
        <>
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

          <FormActions>
            {!modoEdicao && (
              <Button variant="outline" onClick={() => setEtapa(1)} disabled={processando}>
                Voltar
              </Button>
            )}
            <Button variant="outline" onClick={pedirCancelamento} disabled={processando}>
              {jaEnviada ? 'Fechar' : 'Cancelar'}
            </Button>
            <Button variant="outline" onClick={salvarRascunho} disabled={processando}>
              {jaEnviada ? 'Salvar' : 'Salvar Rascunho'}
            </Button>
            <Button variant="accent" onClick={avancarEtapa2} disabled={processando}>
              {processando ? 'Avançando...' : 'Avançar'}
            </Button>
          </FormActions>
        </>
      )}

      {etapa === 3 && (
        <>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>
            {jaEnviada ? 'Resumo da inscrição:' : 'Confira antes de enviar:'}
          </p>
          <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
            <li>Edital lido e aceito</li>
            <li>Histórico Escolar: {historico?.nome_original}</li>
            <li>Comprovante de Matrícula: {matricula?.nome_original}</li>
            {adicionais
              .filter((slot) => slot.documento)
              .map((slot) => (
                <li key={slot.key}>Documento adicional: {slot.documento.nome_original}</li>
              ))}
            {linkLattes && <li>Link Lattes: {linkLattes}</li>}
          </ul>

          <FormActions>
            <Button variant="outline" onClick={() => setEtapa(2)} disabled={processando}>
              Voltar
            </Button>
            <Button variant="outline" onClick={pedirCancelamento} disabled={processando}>
              {jaEnviada ? 'Fechar' : 'Cancelar'}
            </Button>
            {jaEnviada ? (
              <Button variant="accent" onClick={salvarRascunho} disabled={processando}>
                {processando ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={salvarRascunho} disabled={processando}>
                  Salvar Rascunho
                </Button>
                <Button variant="accent" onClick={pedirConfirmacaoFinal} disabled={processando}>
                  {processando ? 'Enviando...' : 'Confirmar Inscrição'}
                </Button>
              </>
            )}
          </FormActions>
        </>
      )}
    </Modal>
  )
}
