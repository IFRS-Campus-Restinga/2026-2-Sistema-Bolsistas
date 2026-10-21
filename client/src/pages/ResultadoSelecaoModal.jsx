import { useEffect, useState } from 'react'
import { selecaoFetch } from '../api'
import { Alert, Badge, Button, Carregando, DataTable, FormActions, Modal } from '../components'
import { mensagemDeErro } from '../utils/mensagemDeErro'

/**
 * Resultado final publicado de uma bolsa, visível a todos os candidatos dela.
 */
export default function ResultadoSelecaoModal({ bolsaId, onFechar }) {
  const [consulta, setConsulta] = useState({ carregando: true, resultado: null, erro: '' })

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const res = await selecaoFetch(`/bolsas/${bolsaId}/resultado/`)
        const dados = await res.json().catch(() => null)
        if (!res.ok)
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar o resultado.'))
        if (ativo) setConsulta({ carregando: false, resultado: dados, erro: '' })
      } catch (e) {
        if (ativo) setConsulta({ carregando: false, resultado: null, erro: e.message })
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [bolsaId])

  const { carregando, resultado, erro } = consulta

  const mostraNotas = Boolean(resultado?.mostra_notas)
  const linhas = (resultado?.resultados || []).map((linha) => [
    linha.posicao ? `${linha.posicao}º` : '',
    linha.sou_eu ? <strong key="nome">{linha.aluno_nome} (você)</strong> : linha.aluno_nome,
    ...(mostraNotas ? [linha.nota_final] : []),
    <Badge key="situacao" status={linha.situacao} />,
  ])

  return (
    <Modal title="Resultado da seleção" onClose={onFechar} width={640}>
      {carregando && <Carregando texto="Carregando resultado..." />}
      {erro && <Alert tone="error">{erro}</Alert>}
      {resultado && (
        <>
          <p>
            <strong>Projeto:</strong> {resultado.projeto_titulo}
          </p>
          <p>
            <strong>Edital:</strong> {resultado.edital_nome}
          </p>
          <p className="mb-3">
            <strong>Vagas:</strong> {resultado.quantidade_vagas}
            {resultado.nota_minima && (
              <>
                {' '}
                · <strong>Nota mínima:</strong> {resultado.nota_minima}
              </>
            )}{' '}
            · <strong>Publicado em:</strong>{' '}
            {new Date(resultado.publicado_em).toLocaleString('pt-BR')}
          </p>
          <DataTable
            columns={['Posição', 'Candidato', ...(mostraNotas ? ['Nota final'] : []), 'Situação']}
            rows={linhas}
            emptyMessage="Nenhum candidato avaliado."
          />
        </>
      )}
      <FormActions>
        <Button variant="outline" onClick={onFechar}>
          Fechar
        </Button>
      </FormActions>
    </Modal>
  )
}
