import { useState } from 'react'
import { editaisFetch } from '../api'
import { Alert, Button, FormActions, FormField, TextInput } from '../components'

export default function EditalForm({ onSalvar, onCancelar }) {
  const [dados, setDados] = useState({
    nome: '',
    ano_semestre: '',
    link_documento_oficial: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function alterarCampo(event) {
    const { name, value } = event.target
    setDados((atual) => ({ ...atual, [name]: value }))
  }

  async function enviar(event) {
    event.preventDefault()
    if (salvando) return

    setSalvando(true)
    setErro('')

    try {
      const response = await editaisFetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      })
      const resultado = await response.json().catch(() => null)

      if (!response.ok) {
        const mensagem =
          resultado && typeof resultado === 'object'
            ? Object.entries(resultado)
                .map(([campo, mensagens]) => {
                  const texto = Array.isArray(mensagens) ? mensagens.join(' ') : String(mensagens)
                  return `${campo}: ${texto}`
                })
                .join(' ')
            : 'Não foi possível cadastrar o edital.'

        throw new Error(mensagem)
      }

      onSalvar(resultado)
    } catch (error) {
      setErro(error.message || 'Falha ao conectar ao servidor.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={enviar} aria-label="Cadastro de edital">
      {erro && <Alert tone="error">{erro}</Alert>}

      <FormField label="Nome">
        <TextInput
          aria-label="Nome"
          name="nome"
          value={dados.nome}
          onChange={alterarCampo}
          minLength={3}
          maxLength={200}
          required
          disabled={salvando}
        />
      </FormField>

      <FormField label="Ano/semestre">
        <TextInput
          aria-label="Ano/semestre"
          name="ano_semestre"
          value={dados.ano_semestre}
          onChange={alterarCampo}
          placeholder="2026/2"
          pattern="[0-9]{4}/[12]"
          title="Use o formato AAAA/1 ou AAAA/2."
          maxLength={6}
          required
          disabled={salvando}
        />
      </FormField>

      <FormField label="Link do documento oficial">
        <TextInput
          aria-label="Link do documento oficial"
          type="url"
          name="link_documento_oficial"
          value={dados.link_documento_oficial}
          onChange={alterarCampo}
          placeholder="https://..."
          maxLength={500}
          required
          disabled={salvando}
        />
      </FormField>

      <p>O edital será cadastrado como Rascunho.</p>

      <FormActions>
        <Button onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar edital'}
        </Button>
      </FormActions>
    </form>
  )
}
