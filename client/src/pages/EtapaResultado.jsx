import { useState } from 'react'
import { selecaoFetch } from '../api'
import {
  Alert,
  Avatar,
  Button,
  EmptyState,
  IconCheckCircle,
  StatusPill,
  useConfirm,
  useToast,
} from '../components'
import { iniciais } from '../utils/iniciais'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import DesempateModal from './DesempateModal'
import IndicarBolsistaModal from './IndicarBolsistaModal'
import NaoAssumiuModal from './NaoAssumiuModal'
import ResultadoSelecaoModal from './ResultadoSelecaoModal'

function situacaoDoCandidato(candidato) {
  if (candidato.desistencia) return 'NAO_ASSUMIU'
  return candidato.situacao || 'NOTAS_PENDENTES'
}

/**
 * Etapa Resultado da seleção: classificação (titulares e suplentes), desempate,
 * publicação do resultado e indicação dos bolsistas.
 */
export default function EtapaResultado({ bolsaId, classificacao, onAtualizada }) {
  const confirmar = useConfirm()
  const toast = useToast()
  const [naoAssumiuDe, setNaoAssumiuDe] = useState(null)
  const [empatados, setEmpatados] = useState(null)
  const [indicacaoDe, setIndicacaoDe] = useState(null)
  const [verResultado, setVerResultado] = useState(false)

  const { bolsa, candidatos } = classificacao
  const publicado = Boolean(classificacao.publicado_em)
  const ranking = candidatos.filter((candidato) => candidato.nota_final !== null)
  const vagas = bolsa.quantidade_vagas

  const gruposEmpate = Object.values(
    candidatos
      .filter((candidato) => candidato.empate_pendente)
      .reduce(
        (grupos, c) => ({ ...grupos, [c.nota_final]: [...(grupos[c.nota_final] || []), c] }),
        {}
      )
  )

  function atualizar(dados, mensagem) {
    onAtualizada(dados)
    if (mensagem) toast({ message: mensagem, tone: 'success' })
  }

  function publicar() {
    confirmar({
      title: 'Publicar resultado?',
      message:
        'O resultado ficará visível a todos os candidatos da bolsa e as notas não poderão mais ser alteradas.',
      confirmLabel: 'Publicar resultado',
      tone: 'accent',
      onConfirm: async () => {
        const res = await selecaoFetch(`/bolsas/${bolsaId}/publicar/`, { method: 'POST' })
        const dados = await res.json().catch(() => null)
        if (!res.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível publicar.'))
        atualizar(dados, 'Resultado publicado. Os candidatos foram notificados.')
      },
    })
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {vagas} {vagas === 1 ? 'vaga' : 'vagas'} · nota mínima {bolsa.nota_minima ?? '—'} ·
          titulares e suplentes
          {publicado && ` · ${classificacao.vagas_preenchidas} de ${vagas} indicados`}
        </p>
        <div className="flex flex-wrap gap-2">
          {!publicado &&
            gruposEmpate.map((grupo) => (
              <Button key={grupo[0].nota_final} onClick={() => setEmpatados(grupo)}>
                Desempatar nota {grupo[0].nota_final}
              </Button>
            ))}
          {publicado ? (
            <Button onClick={() => setVerResultado(true)}>Ver resultado publicado</Button>
          ) : (
            <Button variant="primary" onClick={publicar} disabled={!classificacao.pode_publicar}>
              Publicar resultado
            </Button>
          )}
        </div>
      </div>

      {!publicado && classificacao.pendencias_publicacao.length > 0 && (
        <Alert tone="warning" title="Para publicar o resultado">
          <ul className="mt-1 list-disc pl-5">
            {classificacao.pendencias_publicacao.map((pendencia) => (
              <li key={pendencia}>{pendencia}</li>
            ))}
          </ul>
        </Alert>
      )}
      {publicado && (
        <Alert tone="info">
          Resultado publicado em {new Date(classificacao.publicado_em).toLocaleString('pt-BR')}. Os
          titulares são indicados direto; se um titular não for assumir, registre em &quot;Não vai
          assumir&quot; para liberar a vaga a um suplente. Indicar um suplente fora da ordem exige
          justificativa.
        </Alert>
      )}

      {ranking.length === 0 ? (
        <EmptyState
          compact
          title="Nenhum candidato com nota final"
          description="Lance as notas na etapa anterior."
        />
      ) : (
        <ol className="flex list-none flex-col gap-2">
          {ranking.map((candidato, indice) => (
            <li
              key={candidato.inscricao}
              className="flex flex-wrap items-center gap-4 rounded-controle border border-gray-200 px-4 py-3"
            >
              <span className="w-6 text-center text-[15px] font-semibold text-gray-400 tabular-nums">
                {candidato.posicao ?? indice + 1}º
              </span>
              <Avatar initials={iniciais(candidato.aluno_nome)} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-900">
                  {candidato.aluno_nome}
                </span>
                {candidato.empate_pendente && (
                  <span className="block text-xs text-amber-700">Empate a resolver</span>
                )}
                {candidato.bolsista_em_outra_bolsa && (
                  <span className="block text-xs text-gray-500">
                    Já é bolsista ativo de outra bolsa
                  </span>
                )}
                {candidato.desistencia && (
                  <span className="block text-xs text-gray-500">
                    Não vai assumir: {candidato.desistencia.motivo}
                  </span>
                )}
                {candidato.indicacao?.justificativa && (
                  <span className="block text-xs text-gray-500">
                    Justificativa: {candidato.indicacao.justificativa}
                  </span>
                )}
              </span>
              <span className="text-[15px] font-semibold text-gray-900 tabular-nums">
                {candidato.nota_final}
              </span>
              <span className="w-28 text-right">
                <StatusPill status={situacaoDoCandidato(candidato)} />
              </span>
              <span className="flex w-44 justify-end gap-2">
                {candidato.indicacao ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
                    <IconCheckCircle size={14} /> Indicado(a)
                  </span>
                ) : (
                  <>
                    {candidato.pode_registrar_desistencia && (
                      <Button size="sm" variant="ghost" onClick={() => setNaoAssumiuDe(candidato)}>
                        Não vai assumir
                      </Button>
                    )}
                    {candidato.pode_indicar && (
                      <Button size="sm" variant="accent" onClick={() => setIndicacaoDe(candidato)}>
                        Indicar
                      </Button>
                    )}
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {naoAssumiuDe && (
        <NaoAssumiuModal
          bolsaId={bolsaId}
          candidato={naoAssumiuDe}
          onFechar={() => setNaoAssumiuDe(null)}
          onSalvo={(dados) => {
            setNaoAssumiuDe(null)
            atualizar(dados, 'Registrado. O aluno foi notificado.')
          }}
        />
      )}
      {empatados && (
        <DesempateModal
          bolsaId={bolsaId}
          empatados={empatados}
          onFechar={() => setEmpatados(null)}
          onSalvo={(dados) => {
            setEmpatados(null)
            atualizar(dados, 'Ordem de desempate salva.')
          }}
        />
      )}
      {indicacaoDe && (
        <IndicarBolsistaModal
          bolsaId={bolsaId}
          candidato={indicacaoDe}
          onFechar={() => setIndicacaoDe(null)}
          onSalvo={(dados) => {
            setIndicacaoDe(null)
            atualizar(dados, 'Bolsista indicado. O aluno foi notificado.')
          }}
        />
      )}
      {verResultado && (
        <ResultadoSelecaoModal bolsaId={bolsaId} onFechar={() => setVerResultado(false)} />
      )}
    </>
  )
}
