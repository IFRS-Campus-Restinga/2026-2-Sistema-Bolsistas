import { useEffect, useState } from 'react'
import { monitoramentoFetch } from '../api'
import { Alert, Badge, Carregando, DataTable } from '../components'

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

export default function MonitoramentoPage({ secao }) {
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
  if (!dados) return <Carregando texto="Carregando monitoramento..." />

  const configuracao = CONFIGURACOES[secao]
  const itens = dados.detalhes[secao]

  return (
    <>
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
