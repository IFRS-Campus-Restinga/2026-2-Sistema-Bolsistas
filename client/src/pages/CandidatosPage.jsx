import { useEffect, useState } from 'react'
import { inscricoesFetch } from '../api'
import CandidatoAnaliseModal from './CandidatoAnaliseModal'
import {
  AcoesCell,
  useToast,
  Alert,
  Badge,
  Button,
  DataTable,
  IconArrowLeft,
  PageHeader,
} from '../components'

export default function CandidatosPage({ bolsa, projetoTitulo, onVoltar }) {
  const [consulta, setConsulta] = useState({ carregando: true, candidatos: [], erro: '' })
  const [tentativa, setTentativa] = useState(0)
  const [candidatoId, setCandidatoId] = useState(null)
  const toast = useToast()

  useEffect(() => {
    let ativo = true

    async function carregarCandidatos() {
      try {
        const response = await inscricoesFetch(`/bolsa/${bolsa.id}/candidatos/`)
        const dados = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(dados?.detail || 'Não foi possível carregar os candidatos.')
        }
        if (!Array.isArray(dados)) {
          throw new Error('O servidor retornou uma lista de candidatos inválida.')
        }
        if (ativo) setConsulta({ carregando: false, candidatos: dados, erro: '' })
      } catch (error) {
        if (ativo) {
          setConsulta({
            carregando: false,
            candidatos: [],
            erro: error.message || 'Falha ao conectar ao servidor.',
          })
        }
      }
    }

    carregarCandidatos()
    return () => {
      ativo = false
    }
  }, [bolsa.id, tentativa])

  function tentarNovamente() {
    setConsulta({ carregando: true, candidatos: [], erro: '' })
    setTentativa((atual) => atual + 1)
  }

  const linhas = consulta.candidatos.map((candidato) => [
    candidato.aluno_nome,
    candidato.aluno_email || 'Não informado',
    <Badge key={`status-${candidato.id}`} status={candidato.status} />,
    candidato.data_envio ? new Date(candidato.data_envio).toLocaleString('pt-BR') : 'Não informado',
    candidato.documentacao_completa
      ? 'Documentos obrigatórios enviados'
      : 'Documentos obrigatórios faltantes',
    <AcoesCell
      key={`acoes-${candidato.id}`}
      acoes={[
        {
          label: candidato.status === 'PENDENTE' ? 'Analisar' : 'Ver decisão',
          onClick: () => setCandidatoId(candidato.id),
        },
      ]}
    />,
  ])

  return (
    <>
      <Button variant="outline" size="sm" onClick={onVoltar}>
        <IconArrowLeft /> Voltar às bolsas do projeto
      </Button>
      <PageHeader title="Candidatos inscritos" />
      <p>
        {projetoTitulo} — {bolsa.edital_nome} — {bolsa.modalidade} (Bolsa #{bolsa.id})
      </p>
      <p>A presença dos documentos não significa que a inscrição foi homologada.</p>

      {consulta.carregando ? (
        <p role="status">Carregando candidatos...</p>
      ) : consulta.erro ? (
        <>
          <Alert tone="error">{consulta.erro}</Alert>
          <Button variant="outline" onClick={tentarNovamente}>
            Tentar novamente
          </Button>
        </>
      ) : (
        <DataTable
          columns={['Nome', 'E-mail', 'Status', 'Enviada em', 'Documentação', 'Ações']}
          rows={linhas}
          emptyMessage="Nenhum candidato com inscrição enviada para esta bolsa."
        />
      )}
      {candidatoId && (
        <CandidatoAnaliseModal
          key={candidatoId}
          candidatoId={candidatoId}
          onFechar={() => setCandidatoId(null)}
          onDecisao={(atualizado) => {
            setConsulta((atual) => ({
              ...atual,
              candidatos: atual.candidatos.map((item) =>
                item.id === atualizado.id ? atualizado : item
              ),
            }))
            setCandidatoId(null)
            toast({
              message: 'Decisão registrada. O aluno foi notificado no sistema.',
              tone: 'success',
            })
          }}
        />
      )}
    </>
  )
}
