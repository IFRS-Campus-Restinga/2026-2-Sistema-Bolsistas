import { useEffect, useState } from 'react'
import { bolsistasFetch } from '../api'
import { AcoesCell, Alert, Badge, DataTable, PageHeader, useConfirm, useToast } from '../components'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import MotivoModal from './MotivoModal'
import TermoAssinadoModal from './TermoAssinadoModal'

export default function MeusBolsistasPage() {
  const confirmar = useConfirm()
  const toast = useToast()
  const [vinculos, setVinculos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [pedidos, setPedidos] = useState([])
  const [desligando, setDesligando] = useState(null)
  const [cancelando, setCancelando] = useState(null)
  const [rejeitando, setRejeitando] = useState(null)
  const [enviandoTermo, setEnviandoTermo] = useState(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const [responseVinculos, responsePedidos] = await Promise.all([
          bolsistasFetch('/vinculos/'),
          bolsistasFetch('/desligamentos/pendentes/'),
        ])
        const [dadosVinculos, dadosPedidos] = await Promise.all([
          responseVinculos.json().catch(() => null),
          responsePedidos.json().catch(() => null),
        ])
        if (!responseVinculos.ok || !Array.isArray(dadosVinculos)) {
          throw new Error(mensagemDeErro(dadosVinculos, 'Não foi possível carregar os bolsistas.'))
        }
        if (!responsePedidos.ok || !Array.isArray(dadosPedidos)) {
          throw new Error(mensagemDeErro(dadosPedidos, 'Não foi possível carregar os pedidos.'))
        }
        if (ativo) {
          setVinculos(dadosVinculos)
          setPedidos(dadosPedidos)
          setErro('')
        }
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
  }, [versao])

  async function executarGeracaoTermo(vinculo) {
    const response = await bolsistasFetch(`/vinculos/${vinculo.id}/termo/gerar/`, {
      method: 'POST',
    })
    const dados = await response.json().catch(() => null)
    if (!response.ok) {
      toast({ message: mensagemDeErro(dados, 'Não foi possível gerar o termo.'), tone: 'error' })
      return
    }
    toast({
      message: vinculo.termo ? 'Novo Termo de Compromisso gerado.' : 'Termo de Compromisso gerado.',
      tone: 'success',
    })
    setVersao((atual) => atual + 1)
  }

  function gerarTermo(vinculo) {
    if (!vinculo.termo?.aluno_assinou) {
      executarGeracaoTermo(vinculo)
      return
    }
    confirmar({
      title: 'Gerar novo termo?',
      message:
        'O aluno já assinou a versão atual. Ao gerar um novo termo, essa assinatura será invalidada e o aluno precisará enviar outra versão assinada.',
      confirmLabel: 'Gerar novo termo',
      tone: 'danger',
      onConfirm: () => executarGeracaoTermo(vinculo),
    })
  }

  function acoesDoVinculo(vinculo) {
    const acoes = []
    if (vinculo.pode_gerar_termo && !vinculo.termo?.assinado) {
      acoes.push({
        label: vinculo.termo ? 'Gerar novo termo' : 'Gerar termo',
        variant: 'accent',
        onClick: () => gerarTermo(vinculo),
      })
    }
    if (vinculo.termo) {
      acoes.push({
        label: vinculo.termo.assinado ? 'Baixar termo assinado' : 'Baixar termo em DOCX',
        variant: 'outline',
        onClick: () =>
          window.open(
            vinculo.termo.assinado
              ? vinculo.termo.arquivo_assinado_url
              : vinculo.termo.arquivo_gerado_url,
            '_blank',
            'noopener'
          ),
      })
      if (vinculo.termo.aluno_assinou && !vinculo.termo.assinado) {
        acoes.push({
          label: 'Revisar assinatura do aluno',
          variant: 'outline',
          onClick: () =>
            window.open(vinculo.termo.arquivo_assinado_aluno_url, '_blank', 'noopener'),
        })
        acoes.push({
          label: 'Enviar termo final',
          variant: 'accent',
          onClick: () => setEnviandoTermo(vinculo),
        })
      }
    }

    if (vinculo.status === 'ATIVO') {
      acoes.push({
        label: 'Desligar bolsista',
        variant: 'danger',
        onClick: () => setDesligando(vinculo),
      })
    } else if (!vinculo.vaga_cancelada) {
      acoes.push({
        label: 'Cancelar vaga',
        variant: 'danger',
        onClick: () => setCancelando(vinculo),
      })
    }
    return acoes
  }

  async function enviarMotivo(caminho, motivo, mensagem) {
    const response = await bolsistasFetch(caminho, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo }),
    })
    const dados = await response.json().catch(() => null)
    if (!response.ok) throw new Error(mensagemDeErro(dados, mensagem))
    setVersao((atual) => atual + 1)
  }

  function aprovarPedido(pedido) {
    confirmar({
      title: 'Aprovar pedido de desligamento?',
      message: `${pedido.aluno_nome} será desligado(a) imediatamente e a bolsa voltará para Em Seleção.`,
      confirmLabel: 'Aprovar desligamento',
      tone: 'danger',
      onConfirm: async () => {
        const response = await bolsistasFetch(`/desligamentos/${pedido.id}/decisao/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aprovar: true }),
        })
        const dados = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível aprovar o pedido.'))
        }
        toast({ message: 'Pedido aprovado e vínculo desligado.', tone: 'success' })
        setVersao((atual) => atual + 1)
      },
    })
  }

  async function rejeitarPedido(justificativa) {
    const response = await bolsistasFetch(`/desligamentos/${rejeitando.id}/decisao/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aprovar: false, justificativa }),
    })
    const dados = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(mensagemDeErro(dados, 'Não foi possível rejeitar o pedido.'))
    }
    setRejeitando(null)
    toast({ message: 'Pedido de desligamento rejeitado.', tone: 'success' })
    setVersao((atual) => atual + 1)
  }

  const termosAguardandoCoordenador = vinculos.filter(
    (vinculo) => vinculo.termo?.aluno_assinou && !vinculo.termo.assinado
  )
  const linhas = vinculos.map((vinculo) => [
    <div key="aluno" className="text-left">
      <p className="font-medium text-gray-900">{vinculo.aluno_nome}</p>
      <p className="text-xs text-gray-400">{vinculo.aluno_email}</p>
    </div>,
    vinculo.projeto_titulo,
    `${vinculo.edital_ano_codigo} · ${vinculo.bolsa_tipo_display}`,
    vinculo.origem_display,
    <div key="vinculo" className="flex flex-col items-start gap-1">
      <Badge status={vinculo.status} />
      {vinculo.vaga_cancelada && <Badge status="CANCELADA" label="Vaga cancelada" />}
    </div>,
    <AcoesCell key="acoes" acoes={acoesDoVinculo(vinculo)} />,
  ])

  const linhasPedidos = pedidos.map((pedido) => [
    pedido.aluno_nome,
    pedido.projeto_titulo,
    pedido.motivo,
    <Badge key="status" status={pedido.status} />,
    <AcoesCell
      key="acoes"
      acoes={[
        { label: 'Aprovar', variant: 'accent', onClick: () => aprovarPedido(pedido) },
        { label: 'Rejeitar', variant: 'danger', onClick: () => setRejeitando(pedido) },
      ]}
    />,
  ])

  return (
    <>
      <PageHeader title="Meus Bolsistas" />

      {erro && <Alert tone="error">{erro}</Alert>}

      {termosAguardandoCoordenador.map((vinculo) => (
        <Alert key={`termo-${vinculo.id}`} tone="warning">
          {vinculo.aluno_nome} assinou sua parte do Termo de Compromisso do projeto “
          {vinculo.projeto_titulo}”. Revise o arquivo e envie a versão final assinada pelo
          coordenador.
        </Alert>
      ))}

      {pedidos.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-3 text-base font-bold text-gray-900">Pedidos de desligamento</h2>
          <DataTable
            columns={['Aluno', 'Projeto', 'Motivo', 'Status', 'Ações']}
            rows={linhasPedidos}
            porPagina={null}
          />
        </section>
      )}

      <p className="mb-4 text-sm text-gray-500">
        O relatório final de cada bolsista é solicitado e avaliado na aba Finalização.
      </p>

      <DataTable
        columns={['Bolsista', 'Projeto', 'Edital e tipo', 'Ingresso', 'Vínculo', 'Ações']}
        rows={linhas}
        loading={carregando}
        emptyMessage="Seus projetos ainda não têm bolsistas."
      />

      {enviandoTermo && (
        <TermoAssinadoModal
          vinculo={enviandoTermo}
          final
          onFechar={() => setEnviandoTermo(null)}
          onEnviado={() => {
            setEnviandoTermo(null)
            toast({ message: 'Termo final enviado e vínculo ativado.', tone: 'success' })
            setVersao((atual) => atual + 1)
          }}
        />
      )}

      {desligando && (
        <MotivoModal
          title="Desligar bolsista"
          description={`${desligando.aluno_nome} será desligado(a) imediatamente e a bolsa voltará para Em Seleção.`}
          confirmLabel="Confirmar desligamento"
          onClose={() => setDesligando(null)}
          onConfirm={async (motivo) => {
            await enviarMotivo(
              `/vinculos/${desligando.id}/desligamento/`,
              motivo,
              'Não foi possível desligar o bolsista.'
            )
            setDesligando(null)
            toast({ message: 'Bolsista desligado.', tone: 'success' })
          }}
        />
      )}

      {cancelando && (
        <MotivoModal
          title="Cancelar vaga"
          description="Use esta opção quando não houver mais tempo para substituir o bolsista. Os demais vínculos permanecem ativos."
          label="Justificativa"
          confirmLabel="Confirmar cancelamento"
          onClose={() => setCancelando(null)}
          onConfirm={async (motivo) => {
            await enviarMotivo(
              `/vinculos/${cancelando.id}/cancelar-vaga/`,
              motivo,
              'Não foi possível cancelar a vaga.'
            )
            setCancelando(null)
            toast({ message: 'Vaga cancelada.', tone: 'success' })
          }}
        />
      )}

      {rejeitando && (
        <MotivoModal
          title="Rejeitar pedido de desligamento"
          description={`Informe para ${rejeitando.aluno_nome} por que o pedido não será aprovado.`}
          label="Justificativa"
          confirmLabel="Confirmar rejeição"
          onClose={() => setRejeitando(null)}
          onConfirm={rejeitarPedido}
        />
      )}
    </>
  )
}
