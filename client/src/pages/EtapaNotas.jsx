import { useState } from 'react'
import { selecaoFetch } from '../api'
import { Alert, Button, EmptyState, Hint, TextInput, useToast } from '../components'
import { formatarPeso } from '../utils/formatarPeso'
import { mensagemDeErro } from '../utils/mensagemDeErro'

/**
 * Etapa Notas da seleção: notas de cada etapa de avaliação digitadas na própria linha,
 * com a nota final calculada pelo backend.
 */
export default function EtapaNotas({ bolsaId, classificacao, onAtualizada }) {
  const toast = useToast()
  const [rascunho, setRascunho] = useState({}) // { inscricao: { etapa: valor } }
  const [salvando, setSalvando] = useState(null)
  const [erro, setErro] = useState('')
  const { etapas, candidatos } = classificacao
  const publicado = Boolean(classificacao.publicado_em)
  const podeLancar = classificacao.pode_lancar_notas && !publicado

  if (etapas.length === 0) {
    return (
      <EmptyState
        compact
        title="Nenhuma etapa de avaliação definida"
        description="Defina as etapas e os pesos na bolsa, em Meus projetos."
      />
    )
  }
  if (candidatos.length === 0) {
    return (
      <EmptyState
        compact
        title="Nenhum candidato homologado"
        description="Homologue as inscrições para lançar as notas."
      />
    )
  }

  const pesoTotal = etapas.reduce((soma, etapa) => soma + Number(etapa.peso_efetivo || 0), 0)

  function valores(candidato) {
    return (
      rascunho[candidato.inscricao] ??
      Object.fromEntries(etapas.map((etapa) => [etapa.id, candidato.notas[etapa.id] ?? '']))
    )
  }

  async function salvar(candidato) {
    const notas = valores(candidato)
    setSalvando(candidato.inscricao)
    setErro('')
    try {
      const res = await selecaoFetch(
        `/bolsas/${bolsaId}/inscricoes/${candidato.inscricao}/notas/`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notas: etapas.map((etapa) => {
              const nota = String(notas[etapa.id] ?? '').replace(',', '.')
              return { etapa: etapa.id, nota: nota === '' ? null : nota }
            }),
          }),
        }
      )
      const dados = await res.json().catch(() => null)
      if (!res.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível salvar as notas.'))
      setRascunho((atual) => {
        const copia = { ...atual }
        delete copia[candidato.inscricao]
        return copia
      })
      onAtualizada(dados)
      toast({ message: 'Notas salvas.', tone: 'success' })
    } catch (error) {
      setErro(error.message)
    } finally {
      setSalvando(null)
    }
  }

  return (
    <>
      <Hint>
        Notas de 0 a 10. A nota final é a média ponderada pelos pesos das etapas (total{' '}
        {formatarPeso(pesoTotal)}).
      </Hint>
      {!podeLancar && classificacao.motivo_bloqueio_notas && (
        <Alert tone="warning">{classificacao.motivo_bloqueio_notas}</Alert>
      )}
      {publicado && (
        <Alert tone="info">O resultado foi publicado; as notas estão bloqueadas.</Alert>
      )}
      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="overflow-x-auto rounded-controle border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/70 text-xs text-gray-500">
              <th className="px-4 py-2.5 text-left font-medium">Candidato</th>
              {etapas.map((etapa) => (
                <th key={etapa.id} className="px-3 py-2.5 text-left font-medium">
                  {etapa.nome}{' '}
                  <span className="text-gray-400">· peso {formatarPeso(etapa.peso_efetivo)}</span>
                </th>
              ))}
              <th className="px-4 py-2.5 text-right font-medium">Nota final</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {candidatos.map((candidato) => {
              const atuais = valores(candidato)
              const alterado = Boolean(rascunho[candidato.inscricao])
              return (
                <tr key={candidato.inscricao} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{candidato.aluno_nome}</td>
                  {etapas.map((etapa) => (
                    <td key={etapa.id} className="px-3 py-2">
                      <TextInput
                        className="w-20! tabular-nums"
                        inputMode="decimal"
                        aria-label={`${etapa.nome} de ${candidato.aluno_nome}`}
                        disabled={!podeLancar}
                        value={atuais[etapa.id] ?? ''}
                        onChange={(evento) =>
                          setRascunho((atual) => ({
                            ...atual,
                            [candidato.inscricao]: { ...atuais, [etapa.id]: evento.target.value },
                          }))
                        }
                      />
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900 tabular-nums">
                    {candidato.nota_final ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {alterado && (
                      <Button
                        size="sm"
                        variant="primary"
                        loading={salvando === candidato.inscricao}
                        onClick={() => salvar(candidato)}
                      >
                        Salvar
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
