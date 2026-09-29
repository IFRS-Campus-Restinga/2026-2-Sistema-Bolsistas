import { useEffect, useState } from 'react'
import { inscricoesFetch } from '../api'
import { Alert, Badge, Button, DataTable, PageHeader } from '../components'
import RecursosModal from './RecursosModal'

export default function MeusRecursosPage() {
  const [recursos, setRecursos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [inscricaoId, setInscricaoId] = useState(null)
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        const res = await inscricoesFetch('/recursos/')
        const dados = await res.json()
        if (!res.ok || !Array.isArray(dados))
          throw new Error('Não foi possível carregar o histórico.')
        if (ativo) setRecursos(dados)
      } catch (e) {
        if (ativo) setErro(e.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [tentativa])
  return (
    <>
      <PageHeader title="Meus Recursos" />
      {carregando ? (
        <p role="status">Carregando recursos...</p>
      ) : erro ? (
        <>
          <Alert tone="error">{erro}</Alert>
          <Button onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</Button>
        </>
      ) : (
        <DataTable
          columns={['Projeto', 'Edital', 'Justificativa', 'Enviado em', 'Status', 'Ações']}
          rows={recursos.map((recurso) => [
            recurso.projeto_titulo,
            recurso.edital_nome,
            recurso.justificativa,
            new Date(recurso.criado_em).toLocaleString('pt-BR'),
            <Badge key="status" status={recurso.status} />,
            <Button
              key="detalhes"
              variant="outline"
              size="sm"
              onClick={() => setInscricaoId(recurso.inscricao)}
            >
              Ver detalhes
            </Button>,
          ])}
          emptyMessage="Você não interpôs nenhum recurso."
        />
      )}
      {inscricaoId && (
        <RecursosModal
          key={inscricaoId}
          inscricaoId={inscricaoId}
          somenteHistorico
          onFechar={() => setInscricaoId(null)}
          onAtualizar={() => setTentativa((n) => n + 1)}
        />
      )}
    </>
  )
}
