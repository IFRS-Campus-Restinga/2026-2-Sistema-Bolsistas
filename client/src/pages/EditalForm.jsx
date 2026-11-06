import { useState } from 'react'
import { editaisFetch } from '../api'
import { Alert, Button, FormActions, FormField, Modal, TextInput, useConfirm } from '../components'

const campos = [
  { name: 'nome', label: 'Nome', minLength: 3, maxLength: 200 },
  {
    name: 'ano_codigo',
    label: 'Ano/código',
    pattern: '[0-9]{4}-[0-9]{3}',
    placeholder: '2026-005',
    title: 'Use AAAA-NNN, como 2026-005.',
    maxLength: 8,
  },
  {
    name: 'link_documento_oficial',
    label: 'Link do documento oficial',
    type: 'url',
    maxLength: 500,
  },
]

const datas = [
  ['data_abertura_inscricoes', 'Abertura das inscrições'],
  ['data_fechamento_inscricoes', 'Fechamento das inscrições'],
  ['data_homologacao', 'Homologação'],
  ['data_recurso_homologacao_inicio', 'Início dos recursos'],
  ['data_recurso_homologacao_fim', 'Fim dos recursos'],
  ['data_resultado', 'Resultado'],
  ['data_entrega_relatorios', 'Entrega de relatórios'],
]

const CAMPO_DIA_LIMITE = 'dia_limite_frequencia'

const nomesCampos = [
  ...campos.map((campo) => campo.name),
  ...datas.map(([nome]) => nome),
  CAMPO_DIA_LIMITE,
]

export default function EditalForm({ edital = null, onSalvar, onCancelar }) {
  const confirmar = useConfirm()
  const [iniciais] = useState(() =>
    Object.fromEntries(nomesCampos.map((nome) => [nome, edital?.[nome] ?? '']))
  )
  const [dados, setDados] = useState(iniciais)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [errosCampos, setErrosCampos] = useState({})

  const emVigor = edital?.status === 'EM_VIGOR'
  const alterado = nomesCampos.some((nome) => dados[nome] !== iniciais[nome])

  function solicitarFechamento() {
    if (salvando) return

    if (!alterado) {
      onCancelar()
      return
    }

    confirmar({
      title: 'Descartar alterações?',
      message: 'As alterações não salvas serão perdidas.',
      confirmLabel: 'Descartar',
      tone: 'danger',
      onConfirm: onCancelar,
    })
  }

  function alterarCampo(event) {
    const { name, value } = event.target
    setDados((atuais) => ({ ...atuais, [name]: value }))
    setErrosCampos((atuais) => ({ ...atuais, [name]: null }))
  }

  function mensagemCampo(nome) {
    const mensagens = errosCampos[nome]
    return Array.isArray(mensagens) ? mensagens.join(' ') : mensagens
  }

  async function enviar(event) {
    event.preventDefault()
    if (salvando) return

    setSalvando(true)
    setErro('')
    setErrosCampos({})

    const corpo = { ...dados }
    for (const [nome] of datas) {
      corpo[nome] = corpo[nome] || null
    }
    corpo[CAMPO_DIA_LIMITE] =
      corpo[CAMPO_DIA_LIMITE] === '' ? null : Number(corpo[CAMPO_DIA_LIMITE])

    try {
      const response = await editaisFetch(edital ? `/${edital.id}/` : '/', {
        method: edital ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      const resultado = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status === 400 && resultado) {
          setErrosCampos(resultado)
          const mensagens = resultado.non_field_errors
          setErro(
            Array.isArray(mensagens)
              ? mensagens.join(' ')
              : mensagens || 'Confira os campos informados.'
          )
          return
        }

        throw new Error(resultado?.detail || 'Não foi possível salvar o edital.')
      }

      onSalvar(resultado)
    } catch (error) {
      setErro(error.message || 'Falha ao conectar ao servidor.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      title={edital ? 'Editar edital (1 de 2)' : 'Novo edital (1 de 2)'}
      onClose={solicitarFechamento}
      width={720}
    >
      <form onSubmit={enviar} aria-label="Dados e cronograma do edital">
        <div className="max-h-[65vh] overflow-y-auto p-1">
          {erro && <Alert tone="error">{erro}</Alert>}

          {campos.map(({ label, ...props }) => (
            <FormField key={props.name} label={label}>
              <TextInput
                {...props}
                aria-label={label}
                value={dados[props.name]}
                onChange={alterarCampo}
                required
                disabled={salvando}
                aria-invalid={Boolean(mensagemCampo(props.name))}
                aria-describedby={mensagemCampo(props.name) ? `${props.name}-erro` : undefined}
              />
              {mensagemCampo(props.name) && (
                <p id={`${props.name}-erro`} role="alert">
                  {mensagemCampo(props.name)}
                </p>
              )}
            </FormField>
          ))}

          <h3>Cronograma</h3>

          {datas.map(([nome, label]) => (
            <FormField key={nome} label={label}>
              <TextInput
                type="date"
                name={nome}
                aria-label={label}
                value={dados[nome]}
                onChange={alterarCampo}
                required={emVigor}
                disabled={salvando}
                aria-invalid={Boolean(mensagemCampo(nome))}
                aria-describedby={mensagemCampo(nome) ? `${nome}-erro` : undefined}
              />
              {mensagemCampo(nome) && (
                <div id={`${nome}-erro`} role="alert">
                  <Alert tone="error">{mensagemCampo(nome)}</Alert>
                </div>
              )}
            </FormField>
          ))}

          <FormField label="Dia-limite da frequência mensal">
            <TextInput
              type="number"
              name={CAMPO_DIA_LIMITE}
              min={1}
              max={31}
              aria-label="Dia-limite da frequência mensal"
              value={dados[CAMPO_DIA_LIMITE]}
              onChange={alterarCampo}
              disabled={salvando}
              aria-invalid={Boolean(mensagemCampo(CAMPO_DIA_LIMITE))}
              aria-describedby={
                mensagemCampo(CAMPO_DIA_LIMITE) ? `${CAMPO_DIA_LIMITE}-erro` : undefined
              }
            />
            {mensagemCampo(CAMPO_DIA_LIMITE) && (
              <div id={`${CAMPO_DIA_LIMITE}-erro`} role="alert">
                <Alert tone="error">{mensagemCampo(CAMPO_DIA_LIMITE)}</Alert>
              </div>
            )}
          </FormField>
        </div>

        <FormActions>
          <Button onClick={solicitarFechamento} disabled={salvando}>
            Descartar
          </Button>
          <Button type="submit" variant="accent" loading={salvando}>
            Salvar e continuar
          </Button>
        </FormActions>
      </form>
    </Modal>
  )
}
