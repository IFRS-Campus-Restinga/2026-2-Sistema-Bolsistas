import { useEffect, useState } from 'react'
import { editaisFetch } from '../api'
import { Alert, Button, FormActions, FormField, TextInput } from '../components'

const campos = [
  ['data_abertura_inscricoes', 'Abertura das inscrições'],
  ['data_fechamento_inscricoes', 'Fechamento das inscrições'],
  ['data_homologacao', 'Homologação'],
  ['data_recurso_homologacao_inicio', 'Início dos recursos'],
  ['data_recurso_homologacao_fim', 'Fim dos recursos'],
  ['data_resultado', 'Resultado'],
  ['data_maxima_preenchimento_vagas', 'Preenchimento das vagas'],
  ['data_entrega_relatorios', 'Entrega de relatórios'],
]

export default function CronogramaForm({ edital, onSalvar, onCancelar }) {
  const [dados, setDados] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [errosCampos, setErrosCampos] = useState({})

  const podeEditar = edital.status === 'RASCUNHO'

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const response = await editaisFetch(`/${edital.id}/cronograma/`)
        const resultado = await response.json().catch(() => null)

        if (!response.ok || !resultado) {
          throw new Error(resultado?.detail || 'Não foi possível carregar o cronograma.')
        }

        if (ativo) setDados(resultado)
      } catch (error) {
        if (ativo) {
          setErro(error.message || 'Falha ao conectar ao servidor.')
        }
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [edital.id])

  function alterarCampo(event) {
    const { name, value } = event.target
    setDados((atuais) => ({ ...atuais, [name]: value }))
    setErrosCampos((atuais) => ({ ...atuais, [name]: null }))
  }

  async function enviar(event) {
    event.preventDefault()
    if (salvando || !podeEditar) return

    setSalvando(true)
    setErro('')
    setErrosCampos({})

    const corpo = Object.fromEntries(campos.map(([nome]) => [nome, dados[nome] || null]))

    try {
      const response = await editaisFetch(`/${edital.id}/cronograma/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      const resultado = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status === 400 && resultado) {
          setErrosCampos(resultado)
          const mensagem = resultado.non_field_errors
          setErro(
            mensagem
              ? Array.isArray(mensagem)
                ? mensagem.join(' ')
                : String(mensagem)
              : 'Confira as datas informadas.'
          )
          return
        }

        throw new Error(resultado?.detail || 'Não foi possível salvar o cronograma.')
      }

      onSalvar()
    } catch (error) {
      setErro(error.message || 'Falha ao conectar ao servidor.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <p role="status">Carregando cronograma...</p>
  }

  if (Object.keys(dados).length === 0) {
    return (
      <>
        <Alert tone="error">{erro || 'Cronograma indisponível.'}</Alert>
        <Button onClick={onCancelar}>Voltar</Button>
      </>
    )
  }

  return (
    <form onSubmit={enviar} aria-label="Cronograma do edital">
      <p>{edital.nome}</p>

      {!podeEditar && <p>Consulta do cronograma. A edição está disponível apenas em Rascunho.</p>}

      {erro && <Alert tone="error">{erro}</Alert>}

      {campos.map(([nome, label]) => {
        const mensagens = errosCampos[nome]
        const mensagem = Array.isArray(mensagens) ? mensagens.join(' ') : mensagens

        return (
          <FormField key={nome} label={label}>
            <TextInput
              type="date"
              name={nome}
              aria-label={label}
              value={dados[nome] || ''}
              onChange={alterarCampo}
              disabled={salvando || !podeEditar}
              aria-invalid={Boolean(mensagem)}
              aria-describedby={mensagem ? `${nome}-erro` : undefined}
            />
            {mensagem && (
              <p id={`${nome}-erro`} role="alert">
                {mensagem}
              </p>
            )}
          </FormField>
        )
      })}

      <FormActions>
        <Button onClick={onCancelar} disabled={salvando}>
          Voltar
        </Button>
        {podeEditar && (
          <Button type="submit" variant="accent" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar cronograma'}
          </Button>
        )}
      </FormActions>
    </form>
  )
}
