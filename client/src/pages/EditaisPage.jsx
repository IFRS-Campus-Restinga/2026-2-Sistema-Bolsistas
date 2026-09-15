import { useEffect, useState } from 'react'
import { editaisFetch } from '../api'
import { Alert, Badge, Button, DataTable, PageHeader } from '../components'
import EditalForm from './EditalForm'
import CronogramaForm from './CronogramaForm'

export default function EditaisPage() {
  const [editais, setEditais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [editalCronograma, setEditalCronograma] = useState(null)

  useEffect(() => {
    let ativo = true

    async function carregarEditais() {
      try {
        const response = await editaisFetch()
        const dados = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(dados?.detail || 'Não foi possível carregar os editais.')
        }

        if (!Array.isArray(dados)) {
          throw new Error('A API retornou uma lista de editais inválida.')
        }

        if (ativo) setEditais(dados)
      } catch (error) {
        if (ativo) setErro(error.message || 'Falha ao conectar ao servidor.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarEditais()

    return () => {
      ativo = false
    }
  }, [])

  function concluirCadastro(edital) {
    setEditais((atuais) => [edital, ...atuais])
    setMostrarFormulario(false)
    setSucesso('Edital cadastrado com sucesso.')
  }

  const linhas = editais.map((edital) => [
    edital.nome,
    edital.ano_semestre,
    <Badge key={`status-${edital.id}`} status={edital.status} />,
    <a
      key={`documento-${edital.id}`}
      href={edital.link_documento_oficial}
      target="_blank"
      rel="noopener noreferrer"
    >
      Documento oficial
    </a>,
    <Button
      key={`cronograma-${edital.id}`}
      size="sm"
      onClick={() => {
        setSucesso('')
        setEditalCronograma(edital)
      }}
    >
      Cronograma
    </Button>,
  ])

  if (editalCronograma) {
    return (
      <>
        <PageHeader title="Cronograma do edital" />
        <CronogramaForm
          key={editalCronograma.id}
          edital={editalCronograma}
          onCancelar={() => setEditalCronograma(null)}
          onSalvar={() => {
            setEditalCronograma(null)
            setSucesso('Cronograma salvo com sucesso.')
          }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={mostrarFormulario ? 'Cadastrar edital' : 'Editais'}
        action={
          !mostrarFormulario &&
          !carregando &&
          !erro && (
            <Button
              variant="accent"
              onClick={() => {
                setSucesso('')
                setMostrarFormulario(true)
              }}
            >
              Novo edital
            </Button>
          )
        }
      />

      {sucesso && <Alert tone="success">{sucesso}</Alert>}

      {mostrarFormulario ? (
        <EditalForm onSalvar={concluirCadastro} onCancelar={() => setMostrarFormulario(false)} />
      ) : carregando ? (
        <p role="status">Carregando editais...</p>
      ) : erro ? (
        <Alert tone="error">{erro}</Alert>
      ) : (
        <DataTable
          columns={['Nome', 'Ano/semestre', 'Status', 'Documento', 'Ações']}
          rows={linhas}
          emptyMessage="Nenhum edital cadastrado."
        />
      )}
    </>
  )
}
