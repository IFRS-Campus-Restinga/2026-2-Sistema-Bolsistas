import { useEffect, useState } from 'react'
import { inscricoesFetch } from '../api'
import CandidatoAnaliseModal from './CandidatoAnaliseModal'
import RecursosModal from './RecursosModal'
import { AcoesCell, useToast, Alert, Badge, Button, DataTable } from '../components'

export default function CandidatosPage({ bolsa }) {
  const [consulta, setConsulta] = useState({ carregando: true, candidatos: [], erro: '' })
  const [tentativa, setTentativa] = useState(0)
  const [candidatoId, setCandidatoId] = useState(null)
  const [recursoInscricaoId, setRecursoInscricaoId] = useState(null)
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
    <span key="nome" style={{ whiteSpace: 'nowrap' }}>
      {candidato.aluno_nome}
    </span>,
    candidato.aluno_email || 'Não informado',
    <Badge key={`status-${candidato.id}`} status={candidato.status} />,
    candidato.data_envio ? new Date(candidato.data_envio).toLocaleString('pt-BR') : 'Não informado',
    <AcoesCell
      key={`acoes-${candidato.id}`}
      acoes={[
        {
          label: candidato.status === 'PENDENTE' ? 'Analisar' : 'Ver decisão',
          onClick: () => setCandidatoId(candidato.id),
        },
        ...(['INDEFERIDA', 'HOMOLOGADA'].includes(candidato.status)
          ? [{ label: 'Recursos', onClick: () => setRecursoInscricaoId(candidato.id) }]
          : []),
      ]}
    />,
  ])

  return (
    <>
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
          columns={['Nome', 'E-mail', 'Status', 'Enviada em', 'Ações']}
          rows={linhas}
          emptyMessage="Nenhum candidato com inscrição enviada para esta bolsa."
        />
      )}
      {recursoInscricaoId && (
        <RecursosModal
          key={recursoInscricaoId}
          inscricaoId={recursoInscricaoId}
          coordenador
          onFechar={() => setRecursoInscricaoId(null)}
          onAtualizar={(atualizado) => {
            setConsulta((atual) => ({
              ...atual,
              candidatos: atual.candidatos.map((item) =>
                item.id === atualizado.id ? atualizado : item
              ),
            }))
          }}
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
