import { useEffect, useState } from 'react'
import { monitoramentoFetch } from '../../api'
import {
  Alert,
  Badge,
  DataTable,
  IconBriefcase,
  IconCalendar,
  IconClipboardList,
  StatCard,
} from '../../components'

const CONFIGURACOES = {
  editais_ativos: {
    titulo: 'Editais ativos',
    colunas: ['Edital', 'Ano/Código', 'Status'],
    criarLinhas: (itens) =>
      itens.map((item) => [
        item.nome,
        item.ano_codigo,
        <Badge key="status" status={item.status} />,
      ]),
  },
  bolsas_ativas: {
    titulo: 'Bolsas ativas',
    colunas: ['Projeto', 'Edital', 'Tipo', 'Status'],
    criarLinhas: (itens) =>
      itens.map((item) => [
        item.projeto,
        item.edital,
        item.tipo,
        <Badge key="status" status={item.status} />,
      ]),
  },
  inscricoes_ativas: {
    titulo: 'Inscrições ativas',
    colunas: ['Aluno', 'Projeto', 'Edital', 'Status'],
    criarLinhas: (itens) =>
      itens.map((item) => [
        item.aluno,
        item.projeto,
        item.edital,
        <Badge key="status" status={item.status} />,
      ]),
  },
  inscricoes_encerradas: {
    titulo: 'Inscrições encerradas',
    colunas: ['Aluno', 'Projeto', 'Edital', 'Status'],
    criarLinhas: (itens) =>
      itens.map((item) => [
        item.aluno,
        item.projeto,
        item.edital,
        <Badge key="status" status={item.status} />,
      ]),
  },
}

export default function MonitoramentoPage() {
  const [dados, setDados] = useState(null)
  const [selecionado, setSelecionado] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const response = await monitoramentoFetch('/')
        const resultado = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(resultado.detail || 'Não foi possível carregar o monitoramento.')
        }

        if (ativo) setDados(resultado)
      } catch (error) {
        if (ativo) setErro(error.message)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  if (erro) {
    return <Alert tone="error">{erro}</Alert>
  }

  if (!dados) {
    return <p role="status">Carregando monitoramento...</p>
  }

  const cartoes = [
    {
      chave: 'editais_ativos',
      label: 'Editais Ativos',
      icon: <IconCalendar />,
      color: 'green',
    },
    {
      chave: 'bolsas_ativas',
      label: 'Bolsas Ativas',
      icon: <IconBriefcase />,
      color: 'blue',
    },
    {
      chave: 'inscricoes_ativas',
      label: 'Inscrições Ativas',
      icon: <IconClipboardList />,
      color: 'green',
    },
    {
      chave: 'inscricoes_encerradas',
      label: 'Inscrições Encerradas',
      icon: <IconClipboardList />,
      color: 'red',
    },
  ]

  const configuracao = selecionado ? CONFIGURACOES[selecionado] : null
  const itens = selecionado ? dados.detalhes[selecionado] : []

  return (
    <>
      <h3>Monitoramento global</h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 16,
        }}
      >
        {cartoes.map((cartao) => (
          <StatCard
            key={cartao.chave}
            label={cartao.label}
            value={dados.totais[cartao.chave]}
            icon={cartao.icon}
            color={cartao.color}
            clickable
            onClick={() => setSelecionado(cartao.chave)}
          />
        ))}
      </div>

      {configuracao && (
        <section style={{ marginTop: 28 }}>
          <h3>{configuracao.titulo}</h3>
          <DataTable
            columns={configuracao.colunas}
            rows={configuracao.criarLinhas(itens)}
            emptyMessage={`Nenhum registro em ${configuracao.titulo.toLowerCase()}.`}
          />
        </section>
      )}
    </>
  )
}
