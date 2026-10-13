import { useEffect, useState } from 'react'
import { vinculoDiretoFetch } from '../api'
import { AcoesCell, Alert, Badge, DataTable, PageHeader, useConfirm, useToast } from '../components'
import ConvidarBolsistaModal from './ConvidarBolsistaModal'
import RevisarConviteModal from './RevisarConviteModal'

export default function MeusConvitesPage() {
  const confirmar = useConfirm()
  const toast = useToast()

  const [bolsas, setBolsas] = useState([])
  const [convites, setConvites] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)

  const [bolsaConvidar, setBolsaConvidar] = useState(null)
  const [conviteRevisar, setConviteRevisar] = useState(null)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        const [resBolsas, resConvites] = await Promise.all([
          vinculoDiretoFetch('/bolsas-elegiveis/'),
          vinculoDiretoFetch('/convites/'),
        ])
        if (!resBolsas.ok || !resConvites.ok) {
          throw new Error('Não foi possível carregar os convites de vínculo direto.')
        }
        const dadosBolsas = await resBolsas.json()
        const dadosConvites = await resConvites.json()
        if (ativo) {
          setBolsas(Array.isArray(dadosBolsas) ? dadosBolsas : [])
          setConvites(Array.isArray(dadosConvites) ? dadosConvites : [])
        }
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

  function aoCriarConvite(convite) {
    setBolsas((atuais) => atuais.filter((bolsa) => bolsa.id !== convite.bolsa))
    setConvites((atuais) => [convite, ...atuais])
    setBolsaConvidar(null)
    toast({ message: 'Convite enviado ao aluno.', tone: 'success' })
  }

  function aoDecidirConvite(convite) {
    setConvites((atuais) => atuais.map((item) => (item.id === convite.id ? convite : item)))
    setConviteRevisar(null)
    toast({
      message: convite.status === 'APROVADO' ? 'Vínculo direto aprovado.' : 'Decisão registrada.',
      tone: 'success',
    })
  }

  function cancelarConvite(convite) {
    confirmar({
      title: 'Cancelar convite',
      message: 'O convite será removido e a vaga volta a ficar disponível. Deseja continuar?',
      confirmLabel: 'Cancelar Convite',
      tone: 'danger',
      onConfirm: async () => {
        const res = await vinculoDiretoFetch(`/convites/${convite.id}/cancelar/`, {
          method: 'POST',
        })
        if (res.ok || res.status === 204) {
          setConvites((atuais) => atuais.filter((item) => item.id !== convite.id))
          setTentativa((n) => n + 1)
          toast({ message: 'Convite cancelado.', tone: 'success' })
        } else {
          const corpo = await res.json().catch(() => null)
          toast({ message: corpo?.detail || 'Erro ao cancelar convite.', tone: 'error' })
        }
      },
    })
  }

  const linhasBolsas = bolsas.map((bolsa) => [
    bolsa.projeto_titulo,
    bolsa.edital_nome,
    bolsa.tipo_display,
    bolsa.quantidade_vagas,
    <AcoesCell
      key="acoes"
      acoes={[
        { label: 'Convidar Bolsista', variant: 'accent', onClick: () => setBolsaConvidar(bolsa) },
      ]}
    />,
  ])

  const linhasConvites = convites.map((convite) => [
    convite.aluno_nome,
    convite.projeto_titulo,
    convite.edital_nome,
    <Badge key="status" status={convite.status} />,
    new Date(convite.data_envio_convite).toLocaleDateString('pt-BR'),
    <AcoesCell
      key="acoes"
      acoes={[
        ...(convite.status === 'PENDENTE'
          ? [{ label: 'Cancelar', variant: 'danger', onClick: () => cancelarConvite(convite) }]
          : []),
        ...(convite.status === 'ENVIADO'
          ? [
              {
                label: 'Revisar Documentos',
                variant: 'accent',
                onClick: () => setConviteRevisar(convite.id),
              },
            ]
          : [{ label: 'Ver Detalhes', onClick: () => setConviteRevisar(convite.id) }]),
      ]}
    />,
  ])

  return (
    <>
      <PageHeader title="Meus Convites" />
      {erro && <Alert tone="error">{erro}</Alert>}

      {carregando ? (
        <p role="status">Carregando convites...</p>
      ) : (
        <>
          <PageHeader title="Bolsas elegíveis para convite" />
          <p style={{ marginTop: -8, marginBottom: 16, color: '#6b7280', fontSize: 14 }}>
            Bolsas cujo período de recursos da homologação já encerrou e que ainda têm vaga livre.
          </p>
          <DataTable
            columns={['Projeto', 'Edital', 'Tipo', 'Vagas', 'Ações']}
            rows={linhasBolsas}
            emptyMessage="Nenhuma bolsa elegível para vínculo direto no momento."
          />

          <PageHeader title="Convites enviados" />
          <DataTable
            columns={['Aluno', 'Projeto', 'Edital', 'Status', 'Enviado em', 'Ações']}
            rows={linhasConvites}
            emptyMessage="Nenhum convite enviado ainda."
          />
        </>
      )}

      {bolsaConvidar && (
        <ConvidarBolsistaModal
          bolsa={bolsaConvidar}
          onFechar={() => setBolsaConvidar(null)}
          onCriado={aoCriarConvite}
        />
      )}

      {conviteRevisar && (
        <RevisarConviteModal
          conviteId={conviteRevisar}
          onFechar={() => setConviteRevisar(null)}
          onDecisao={aoDecidirConvite}
        />
      )}
    </>
  )
}
