import { useEffect, useState } from 'react'
import { dadosBancariosFetch } from '../api'
import {
  Alert,
  Button,
  Carregando,
  FileField,
  FormActions,
  FormField,
  PageHeader,
  TextInput,
} from '../components'

function mensagemErro(dados, mensagemPadrao) {
  if (dados?.detail) return dados.detail

  const mensagens = Object.values(dados || {})
    .flat()
    .filter((item) => typeof item === 'string')

  return mensagens.join(' ') || mensagemPadrao
}

export default function DadosBancariosPage() {
  const [form, setForm] = useState({
    matricula: '',
    curso: '',
    cpf: '',
    banco: '',
    agencia: '',
    conta: '',
  })
  const [comprovante, setComprovante] = useState(null)
  const [comprovanteUrl, setComprovanteUrl] = useState(null)
  const [cadastroCompleto, setCadastroCompleto] = useState(false)
  const [cadastroExistente, setCadastroExistente] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const response = await dadosBancariosFetch('/')
        const dados = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(mensagemErro(dados, 'Não foi possível carregar os dados bancários.'))
        }

        if (!ativo) return

        setForm({
          matricula: dados.matricula || '',
          curso: dados.curso || '',
          cpf: dados.cpf || '',
          banco: dados.banco || '',
          agencia: dados.agencia || '',
          conta: dados.conta || '',
        })
        setComprovanteUrl(dados.comprovante_url)
        setCadastroCompleto(dados.cadastro_completo)
        setCadastroExistente(Boolean(dados.id))
      } catch (error) {
        if (ativo) setErro(error.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  function atualizarCampo(event) {
    const { name, value } = event.target

    setForm((atual) => ({
      ...atual,
      [name]: value,
    }))
    setErro('')
    setSucesso('')
  }

  async function salvar(event) {
    event.preventDefault()
    setSalvando(true)
    setErro('')
    setSucesso('')

    if (!comprovante && !comprovanteUrl) {
      setErro('Envie um comprovante bancário.')
      setSalvando(false)
      return
    }

    try {
      const body = new FormData()
      body.append('matricula', form.matricula)
      body.append('curso', form.curso)
      body.append('cpf', form.cpf)
      body.append('banco', form.banco)
      body.append('agencia', form.agencia)
      body.append('conta', form.conta)

      if (comprovante) {
        body.append('comprovante', comprovante)
      }

      const response = await dadosBancariosFetch('/', {
        method: 'PUT',
        body,
      })
      const dados = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(mensagemErro(dados, 'Não foi possível salvar os dados bancários.'))
      }

      setForm({
        matricula: dados.matricula,
        curso: dados.curso,
        cpf: dados.cpf,
        banco: dados.banco,
        agencia: dados.agencia,
        conta: dados.conta,
      })
      setComprovante(null)
      setComprovanteUrl(dados.comprovante_url)
      setCadastroCompleto(dados.cadastro_completo)
      setCadastroExistente(true)
      setSucesso(`Dados bancários ${cadastroExistente ? 'atualizados' : 'salvos'} com sucesso.`)
    } catch (error) {
      setErro(error.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <PageHeader title="Dados Bancários" />

      <p style={{ maxWidth: 760 }}>
        Estes dados são obrigatórios antes que o Coordenador de Projeto possa indicá-lo como titular
        de uma bolsa. A conta cadastrada precisa ser de sua própria titularidade.
      </p>

      {!cadastroCompleto && !carregando && (
        <Alert tone="error">
          Matrícula, curso, CPF, banco, agência, conta e comprovante devem ser informados para
          concluir o cadastro.
        </Alert>
      )}

      {erro && <Alert tone="error">{erro}</Alert>}
      {sucesso && <Alert tone="success">{sucesso}</Alert>}

      {carregando ? (
        <Carregando texto="Carregando dados bancários..." />
      ) : (
        <form
          onSubmit={salvar}
          style={{
            maxWidth: 420,
            marginTop: 16,
            padding: 22,
            background: '#fff',
            borderRadius: 12,
          }}
        >
          <FormField label="Matrícula">
            <TextInput
              name="matricula"
              value={form.matricula}
              placeholder="Ex.: 2026000001"
              onChange={atualizarCampo}
              disabled={salvando}
              maxLength={11}
              required
            />
          </FormField>

          <FormField label="Curso">
            <TextInput
              name="curso"
              value={form.curso}
              placeholder="Ex.: Engenharia de Software"
              onChange={atualizarCampo}
              disabled={salvando}
              maxLength={150}
              required
            />
          </FormField>

          <FormField label="CPF">
            <TextInput
              name="cpf"
              value={form.cpf}
              placeholder="Ex.: 000.000.000-00"
              onChange={atualizarCampo}
              disabled={salvando}
              maxLength={14}
              required
            />
          </FormField>

          <FormField label="Banco">
            <TextInput
              name="banco"
              value={form.banco}
              placeholder="Ex.: Banco do Brasil"
              onChange={atualizarCampo}
              disabled={salvando}
              required
            />
          </FormField>

          <FormField label="Agência">
            <TextInput
              name="agencia"
              value={form.agencia}
              placeholder="Ex.: 1234-5"
              onChange={atualizarCampo}
              disabled={salvando}
              required
              pattern="[0-9]+(-[0-9Xx])?"
              title="Use somente números e, se necessário, hífen antes do dígito."
            />
          </FormField>

          <FormField label="Conta">
            <TextInput
              name="conta"
              value={form.conta}
              placeholder="Ex.: 67890-1"
              onChange={atualizarCampo}
              disabled={salvando}
              required
              pattern="[0-9]+(-[0-9Xx])?"
              title="Use somente números e, se necessário, hífen antes do dígito."
            />
          </FormField>

          <FormField label="Comprovante bancário (cartão, extrato etc.)">
            <FileField
              value={comprovante?.name || ''}
              onChange={setComprovante}
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={salvando}
            />

            {comprovanteUrl && !comprovante && <a href={comprovanteUrl}>Ver comprovante enviado</a>}
          </FormField>

          <FormActions>
            <Button type="submit" variant="accent" loading={salvando}>
              {cadastroExistente ? 'Atualizar' : 'Salvar'}
            </Button>
          </FormActions>
        </form>
      )}
    </>
  )
}
