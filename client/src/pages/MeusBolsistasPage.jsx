import { useEffect, useState } from 'react'
import { bolsistasFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  DataTable,
  FormField,
  PageHeader,
  Select,
  useConfirm,
  useToast,
} from '../components'
import { formatarData } from '../utils/dataHora'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import AvaliarRelatorioModal from './AvaliarRelatorioModal'
import MotivoModal from './MotivoModal'

const SITUACOES = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'NAO_SOLICITADO', rotulo: 'Não solicitado' },
  { valor: 'SOLICITADO', rotulo: 'Solicitado' },
  { valor: 'AGUARDANDO_AVALIACAO', rotulo: 'Aguardando avaliação' },
  { valor: 'REPROVADO', rotulo: 'Reprovado' },
  { valor: 'APROVADO', rotulo: 'Aprovado' },
]

function situacaoDoRelatorio(vinculo) {
  return vinculo.relatorio?.situacao ?? 'NAO_SOLICITADO'
}

export default function MeusBolsistasPage() {
  const confirmar = useConfirm()
  const toast = useToast()
  const [vinculos, setVinculos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('')
  const [avaliando, setAvaliando] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [desligando, setDesligando] = useState(null)
  const [cancelando, setCancelando] = useState(null)
  const [rejeitando, setRejeitando] = useState(null)
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

  function solicitarRelatorio(vinculo) {
    confirmar({
      title: 'Solicitar relatório final?',
      message: `${vinculo.aluno_nome} poderá enviar o relatório final até ${formatarData(vinculo.prazo_relatorio)}, prazo definido no edital.`,
      confirmLabel: 'Solicitar',
      tone: 'accent',
      onConfirm: async () => {
        const response = await bolsistasFetch(`/vinculos/${vinculo.id}/solicitar-relatorio/`, {
          method: 'POST',
        })
        const dados = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível solicitar o relatório.'))
        }
        toast({ message: 'Relatório final solicitado.', tone: 'success' })
        setVersao((atual) => atual + 1)
      },
    })
  }

  function acoesDoVinculo(vinculo) {
    const situacao = situacaoDoRelatorio(vinculo)
    const acoes = []
    if (situacao === 'NAO_SOLICITADO') {
      if (vinculo.pode_solicitar_relatorio) {
        acoes.push({
          label: 'Solicitar relatório final',
          variant: 'accent',
          onClick: () => solicitarRelatorio(vinculo),
        })
      }
    } else if (vinculo.relatorio.arquivo) {
      if (situacao === 'AGUARDANDO_AVALIACAO') {
        acoes.push({
          label: 'Avaliar relatório',
          variant: 'accent',
          onClick: () => setAvaliando(vinculo),
        })
      }
      acoes.push({
        label: 'Baixar relatório',
        variant: 'outline',
        onClick: () => window.open(vinculo.relatorio.arquivo, '_blank', 'noopener'),
      })
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

  const aprovados = vinculos.filter((vinculo) => situacaoDoRelatorio(vinculo) === 'APROVADO')
  const visiveis = filtro
    ? vinculos.filter((vinculo) => situacaoDoRelatorio(vinculo) === filtro)
    : vinculos

  const linhas = visiveis.map((vinculo) => [
    <div key="aluno" className="text-left">
      <p className="font-medium text-gray-900">{vinculo.aluno_nome}</p>
      <p className="text-xs text-gray-400">{vinculo.aluno_email}</p>
    </div>,
    vinculo.projeto_titulo,
    `${vinculo.edital_ano_codigo} · ${vinculo.bolsa_tipo_display}`,
    vinculo.origem_display,
    <div key="vinculo" className="flex flex-col items-center gap-1">
      <Badge status={vinculo.status} />
      {vinculo.vaga_cancelada && <Badge status="CANCELADA" label="Vaga cancelada" />}
    </div>,
    <div key="relatorio" className="flex flex-col items-center gap-1">
      <Badge status={situacaoDoRelatorio(vinculo)} />
      {vinculo.prazo_relatorio && !vinculo.relatorio?.arquivo && (
        <span className="text-xs text-gray-400">
          Prazo: {formatarData(vinculo.prazo_relatorio)}
        </span>
      )}
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

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <FormField label="Situação do relatório final" className="mb-0 min-w-[240px]">
          <Select value={filtro} onChange={(event) => setFiltro(event.target.value)}>
            {SITUACOES.map((situacao) => (
              <option key={situacao.valor} value={situacao.valor}>
                {situacao.rotulo}
              </option>
            ))}
          </Select>
        </FormField>
        {!carregando && vinculos.length > 0 && (
          <span className="pb-2.5 text-sm text-gray-500">
            {aprovados.length} de {vinculos.length}{' '}
            {vinculos.length === 1 ? 'relatório aprovado' : 'relatórios aprovados'}
          </span>
        )}
      </div>

      <DataTable
        columns={[
          'Bolsista',
          'Projeto',
          'Edital e tipo',
          'Ingresso',
          'Vínculo',
          'Relatório final',
          'Ações',
        ]}
        rows={linhas}
        loading={carregando}
        emptyMessage={
          filtro
            ? 'Nenhum bolsista com essa situação de relatório.'
            : 'Seus projetos ainda não têm bolsistas.'
        }
      />

      {avaliando && (
        <AvaliarRelatorioModal
          vinculo={avaliando}
          onFechar={() => setAvaliando(null)}
          onAvaliado={() => {
            setAvaliando(null)
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
