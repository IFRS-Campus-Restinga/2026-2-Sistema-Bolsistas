import { useEffect, useState } from 'react'
import { bolsasFetch } from '../api'
import { Alert, Badge, Button, DataTable, IconArrowLeft, PageHeader } from '../components'
import InscricaoWizard from './InscricaoWizard'

const TIPO_LABEL = {
  ENSINO: 'Ensino',
  PESQUISA: 'Pesquisa',
  EXTENSAO: 'Extensão',
  INDISSOCIAVEL: 'Indissociável',
}

export default function BolsasDisponiveisPage() {
  const [bolsaSelecionadaId, setBolsaSelecionadaId] = useState(null)

  if (bolsaSelecionadaId) {
    return (
      <BolsaDetalhe bolsaId={bolsaSelecionadaId} onVoltar={() => setBolsaSelecionadaId(null)} />
    )
  }

  return <ListaBolsasDisponiveis onVerDetalhes={setBolsaSelecionadaId} />
}

function ListaBolsasDisponiveis({ onVerDetalhes }) {
  const [bolsas, setBolsas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregarBolsas() {
      try {
        const res = await bolsasFetch('/disponiveis/')
        if (!res.ok) throw new Error('Não foi possível carregar as bolsas disponíveis.')
        const dados = await res.json()
        if (ativo) setBolsas(dados)
      } catch (e) {
        if (ativo) setErro(e.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarBolsas()

    return () => {
      ativo = false
    }
  }, [])

  const linhas = bolsas.map((bolsa) => [
    bolsa.projeto_titulo,
    TIPO_LABEL[bolsa.tipo] || bolsa.tipo,
    bolsa.edital_nome,
    `${bolsa.carga_horaria_semanal}h/semana`,
    `R$ ${bolsa.valor_mensal}`,
    <Badge key="status" status={bolsa.status} />,
    <Button key="acoes" size="sm" variant="outline" onClick={() => onVerDetalhes(bolsa.id)}>
      Ver detalhes
    </Button>,
  ])

  return (
    <>
      <PageHeader title="Bolsas Disponíveis" />

      {erro && <Alert tone="error">{erro}</Alert>}

      {carregando ? (
        <p role="status">Carregando bolsas...</p>
      ) : (
        <DataTable
          columns={['Projeto', 'Tipo', 'Edital', 'Carga Horária', 'Valor', 'Status', 'Ações']}
          rows={linhas}
          emptyMessage="Nenhuma bolsa disponível no momento."
        />
      )}
    </>
  )
}

function BolsaDetalhe({ bolsaId, onVoltar }) {
  const [bolsa, setBolsa] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [wizardAberto, setWizardAberto] = useState(false)

  useEffect(() => {
    let ativo = true

    async function carregarBolsa() {
      try {
        const res = await bolsasFetch(`/disponiveis/${bolsaId}/`)
        if (!res.ok) throw new Error('Não foi possível carregar os detalhes da bolsa.')
        const dados = await res.json()
        if (ativo) setBolsa(dados)
      } catch (e) {
        if (ativo) setErro(e.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarBolsa()

    return () => {
      ativo = false
    }
  }, [bolsaId])

  if (carregando) return <p role="status">Carregando bolsa...</p>

  if (erro || !bolsa) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={onVoltar}>
          <IconArrowLeft /> Voltar
        </Button>
        <Alert tone="error">{erro || 'Bolsa não encontrada.'}</Alert>
      </>
    )
  }

  const jaInscrito = !!bolsa.minha_inscricao_status
  const mensagemJaInscrito =
    bolsa.minha_inscricao_status === 'RASCUNHO'
      ? 'Você já iniciou uma inscrição para esta bolsa — continue em Minhas Inscrições.'
      : 'Você já está inscrito nesta bolsa.'

  return (
    <>
      <PageHeader title={bolsa.projeto_titulo} badge={<Badge status={bolsa.status} />} />

      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <p>
          <strong>Edital:</strong> {bolsa.edital_nome}
        </p>
        <p>
          <strong>Tipo:</strong> {bolsa.tipo_display}
        </p>
        <p>
          <strong>Carga horária:</strong> {bolsa.carga_horaria_semanal}h/semana
        </p>
        <p>
          <strong>Valor mensal:</strong> R$ {bolsa.valor_mensal}
        </p>
        {bolsa.nota_minima != null && (
          <p>
            <strong>Nota mínima:</strong> {bolsa.nota_minima}
          </p>
        )}
        <p>
          <strong>Pré-requisitos:</strong> {bolsa.prerequisitos || 'Não informado.'}
        </p>
        <p>
          <strong>Metodologia de avaliação:</strong>{' '}
          {bolsa.metodologia_avaliacao || 'Não informado.'}
        </p>
      </div>

      {jaInscrito && <Alert tone="warning">{mensagemJaInscrito}</Alert>}

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="outline" onClick={onVoltar}>
          Voltar
        </Button>
        {!jaInscrito && (
          <Button variant="accent" onClick={() => setWizardAberto(true)}>
            Inscrever-se nesta bolsa
          </Button>
        )}
      </div>

      {wizardAberto && (
        <InscricaoWizard
          bolsa={bolsa}
          onFechar={() => setWizardAberto(false)}
          onConcluida={() => setWizardAberto(false)}
        />
      )}
    </>
  )
}
