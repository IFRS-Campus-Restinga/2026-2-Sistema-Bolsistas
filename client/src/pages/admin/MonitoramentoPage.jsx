import { useEffect, useState } from 'react'
import { monitoramentoFetch } from '../../api'
import {
  Alert,
  Badge,
  DataTable,
  IconBriefcase,
  IconCalendar,
  IconClipboardList,
  IconUsers,
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
  projetos_cadastrados: {
    titulo: 'Projetos cadastrados',
    colunas: ['Projeto', 'Coordenador', 'Status'],
    criarLinhas: (itens) =>
      itens.map((item) => [
        item.titulo,
        item.coordenador,
        <Badge key="status" status={item.status} />,
      ]),
  },
  usuarios_ativos: {
    titulo: 'Usuários ativos',
    colunas: ['Nome', 'E-mail', 'Perfil', 'Status'],
    criarLinhas: (itens) =>
      itens.map((item) => [
        item.nome,
        item.email,
        item.perfil,
        <Badge key="status" status={item.status} />,
      ]),
  },
  usuarios_inativos: {
    titulo: 'Usuários inativos',
    colunas: ['Nome', 'E-mail', 'Perfil', 'Status'],
    criarLinhas: (itens) =>
      itens.map((item) => [
        item.nome,
        item.email,
        item.perfil,
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

export default function MonitoramentoPage({ secao = null, onNavigate = null }) {
  const [dados, setDados] = useState(null)
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

  if (erro) return <Alert tone="error">{erro}</Alert>
  if (!dados) return <p role="status">Carregando monitoramento...</p>

  const cartoes = [
    {
      chave: 'editais_ativos',
      label: 'Editais Ativos',
      icon: <IconCalendar />,
      color: 'green',
      destino: 'editais',
    },
    {
      chave: 'projetos_cadastrados',
      label: 'Projetos Cadastrados',
      icon: <IconBriefcase />,
      color: 'blue',
      destino: 'projetos',
    },
    {
      chave: 'usuarios_ativos',
      label: 'Usuários Ativos',
      icon: <IconUsers />,
      color: 'green',
      destino: 'usuarios',
    },
    {
      chave: 'usuarios_inativos',
      label: 'Usuários Inativos',
      icon: <IconUsers />,
      color: 'red',
      destino: 'usuarios',
    },
    {
      chave: 'bolsas_ativas',
      label: 'Bolsas Ativas',
      icon: <IconBriefcase />,
      color: 'blue',
      destino: 'bolsas',
    },
    {
      chave: 'inscricoes_ativas',
      label: 'Inscrições Ativas',
      icon: <IconClipboardList />,
      color: 'green',
      destino: 'inscricoes',
    },
    {
      chave: 'inscricoes_encerradas',
      label: 'Inscrições Encerradas',
      icon: <IconClipboardList />,
      color: 'red',
      destino: 'inscricoes',
    },
  ]

  const configuracao = secao ? CONFIGURACOES[secao] : null
  const itens = secao ? dados.detalhes[secao] : []

  return (
    <>
      {!secao && (
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
              onClick={() => onNavigate?.(cartao.destino, cartao.chave)}
            />
          ))}
        </div>
      )}

      {configuracao && (
        <section>
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
