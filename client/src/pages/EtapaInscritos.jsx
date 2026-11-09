import { useEffect, useState } from 'react'
import { inscricoesFetch } from '../api'
import { Alert, Avatar, Button, DataTable, Hint, StatusPill, useToast } from '../components'
import { iniciais } from '../utils/iniciais'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import CandidatoAnaliseDrawer from './CandidatoAnaliseDrawer'

const COR_DA_DECISAO = { APROVADO: 'bg-emerald-500', REJEITADO: 'bg-red-500' }
const NOME_DA_DECISAO = { PENDENTE: 'pendente', APROVADO: 'aprovado', REJEITADO: 'recusado' }

/** Uma barrinha por documento, colorida pela decisão, e quantos já foram aprovados. */
function DecisoesDosDocumentos({ decisoes }) {
  const aprovados = decisoes.filter((d) => d.decisao === 'APROVADO').length
  return (
    <span className="flex items-center gap-1">
      {decisoes.map((d) => (
        <span
          key={d.id}
          title={`${d.tipo_display}: ${NOME_DA_DECISAO[d.decisao]}`}
          className={`h-2 w-5 rounded-full ${COR_DA_DECISAO[d.decisao] ?? 'bg-gray-200'}`}
        />
      ))}
      <span className="ml-1 text-xs text-gray-500">
        {aprovados}/{decisoes.length}
      </span>
    </span>
  )
}

/** Etapa Inscritos da seleção: candidatos da bolsa e a decisão de homologação. */
export default function EtapaInscritos({ bolsa, onMudou }) {
  const toast = useToast()
  const [consulta, setConsulta] = useState({ carregando: true, candidatos: [], erro: '' })
  const [tentativa, setTentativa] = useState(0)
  const [candidatoId, setCandidatoId] = useState(null)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const response = await inscricoesFetch(`/bolsa/${bolsa.id}/candidatos/`)
        const dados = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(dados)) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar os candidatos.'))
        }
        if (ativo) setConsulta({ carregando: false, candidatos: dados, erro: '' })
      } catch (error) {
        if (ativo) setConsulta({ carregando: false, candidatos: [], erro: error.message })
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [bolsa.id, tentativa])

  if (consulta.erro) {
    return (
      <>
        <Alert tone="error">{consulta.erro}</Alert>
        <Button
          onClick={() => {
            setConsulta({ carregando: true, candidatos: [], erro: '' })
            setTentativa((atual) => atual + 1)
          }}
        >
          Tentar novamente
        </Button>
      </>
    )
  }

  const { candidatos } = consulta

  function substituir(atualizado) {
    setConsulta((atual) => ({
      ...atual,
      candidatos: atual.candidatos.map((item) => (item.id === atualizado.id ? atualizado : item)),
    }))
  }
  const linhas = candidatos.map((candidato) => [
    <span key="nome" className="flex items-center gap-2.5">
      <Avatar initials={iniciais(candidato.aluno_nome)} size={26} />
      <span className="font-medium text-gray-900">{candidato.aluno_nome}</span>
    </span>,
    <span key="curso" className="text-gray-600">
      {candidato.aluno_curso || '—'}
    </span>,
    <DecisoesDosDocumentos key="documentos" decisoes={candidato.decisoes_documentos ?? []} />,
    candidato.data_envio ? new Date(candidato.data_envio).toLocaleDateString('pt-BR') : '—',
    <StatusPill key="status" status={candidato.status} />,
  ])

  return (
    <>
      <Hint>Clique em um candidato para revisar os documentos e decidir a homologação.</Hint>
      <DataTable
        columns={['Candidato', 'Curso', 'Documentos', 'Enviada em', 'Situação']}
        rows={linhas}
        loading={consulta.carregando}
        emptyMessage="Nenhuma inscrição nesta bolsa ainda."
        onRowClick={(indice) => setCandidatoId(candidatos[indice].id)}
      />

      {candidatoId && (
        <CandidatoAnaliseDrawer
          key={candidatoId}
          candidatoId={candidatoId}
          onFechar={() => setCandidatoId(null)}
          onAtualizado={substituir}
          onDecisao={(atualizado) => {
            substituir(atualizado)
            setCandidatoId(null)
            toast({
              message: 'Decisão registrada. O aluno foi notificado no sistema.',
              tone: 'success',
            })
            onMudou?.()
          }}
        />
      )}
    </>
  )
}
