import { useEffect, useState } from 'react'
import { selecaoFetch } from '../api'
import {
  AcoesCell,
  Alert,
  Badge,
  Button,
  Carregando,
  DataTable,
  useConfirm,
  useToast,
} from '../components'
import { formatarPeso } from '../utils/formatarPeso'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import DesempateModal from './DesempateModal'
import IndicarBolsistaModal from './IndicarBolsistaModal'
import LancarNotasModal from './LancarNotasModal'
import NaoAssumiuModal from './NaoAssumiuModal'
import ResultadoSelecaoModal from './ResultadoSelecaoModal'

const estiloResumo = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 24,
  padding: 16,
  marginBottom: 16,
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
}

const estiloMarcador = { display: 'block', fontSize: 12, color: '#6b7280', marginTop: 4 }

/**
 * Lançamento de notas, classificação (titulares/suplentes), publicação do resultado
 * e indicação formal dos bolsistas de uma bolsa.
 */
export default function ClassificacaoBolsa({ bolsaId, onAtualizada }) {
  const confirmar = useConfirm()
  const toast = useToast()
  const [consulta, setConsulta] = useState({ carregando: true, dados: null, erro: '' })
  const [tentativa, setTentativa] = useState(0)
  const [notasDe, setNotasDe] = useState(null)
  const [naoAssumiuDe, setNaoAssumiuDe] = useState(null)
  const [empatados, setEmpatados] = useState(null)
  const [indicacaoDe, setIndicacaoDe] = useState(null)
  const [verResultado, setVerResultado] = useState(false)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const res = await selecaoFetch(`/bolsas/${bolsaId}/classificacao/`)
        const dados = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(mensagemDeErro(dados, 'Não foi possível carregar a classificação.'))
        }
        if (ativo) setConsulta({ carregando: false, dados, erro: '' })
      } catch (e) {
        if (ativo) setConsulta({ carregando: false, dados: null, erro: e.message })
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [bolsaId, tentativa])

  function atualizar(dados, mensagem) {
    setConsulta({ carregando: false, dados, erro: '' })
    onAtualizada?.(dados.bolsa)
    if (mensagem) toast({ message: mensagem, tone: 'success' })
  }

  async function enviar(caminho, metodo, mensagem) {
    const res = await selecaoFetch(`/bolsas/${bolsaId}${caminho}`, { method: metodo })
    const dados = await res.json().catch(() => null)
    if (res.ok) atualizar(dados, mensagem)
    else
      toast({ message: mensagemDeErro(dados, 'Não foi possível concluir a ação.'), tone: 'error' })
  }

  function publicar() {
    confirmar({
      title: 'Publicar resultado?',
      message:
        'O resultado ficará visível a todos os candidatos da bolsa e as notas não poderão mais ser alteradas.',
      confirmLabel: 'Publicar resultado',
      tone: 'accent',
      onConfirm: () =>
        enviar('/publicar/', 'POST', 'Resultado publicado. Os candidatos foram notificados.'),
    })
  }

  if (consulta.carregando) return <Carregando texto="Carregando classificação..." />
  if (consulta.erro) {
    return (
      <>
        <Alert tone="error">{consulta.erro}</Alert>
        <Button
          variant="outline"
          onClick={() => {
            setConsulta({ carregando: true, dados: null, erro: '' })
            setTentativa((n) => n + 1)
          }}
        >
          Tentar novamente
        </Button>
      </>
    )
  }

  const { bolsa, etapas, candidatos } = consulta.dados
  const publicado = Boolean(consulta.dados.publicado_em)
  const podeLancar = consulta.dados.pode_lancar_notas

  const gruposEmpate = Object.values(
    candidatos
      .filter((c) => c.empate_pendente)
      .reduce(
        (grupos, c) => ({ ...grupos, [c.nota_final]: [...(grupos[c.nota_final] || []), c] }),
        {}
      )
  )

  function acoes(candidato) {
    if (publicado) {
      const lista = []
      if (candidato.pode_indicar) {
        lista.push({
          label: 'Indicar bolsista',
          variant: 'accent',
          onClick: () => setIndicacaoDe(candidato),
        })
      }
      if (candidato.pode_registrar_desistencia) {
        lista.push({
          label: 'Não vai assumir',
          variant: 'danger',
          onClick: () => setNaoAssumiuDe(candidato),
        })
      }
      return lista
    }
    if (!podeLancar) return []
    return [
      {
        label: Object.keys(candidato.notas).length ? 'Editar notas' : 'Lançar notas',
        onClick: () => setNotasDe(candidato),
      },
    ]
  }

  function badgeDaSituacao(candidato) {
    if (candidato.indicacao) return 'INDICADO'
    if (candidato.desistencia) return 'NAO_ASSUMIU'
    return candidato.situacao || 'NOTAS_PENDENTES'
  }

  function situacao(candidato) {
    return (
      <div key={`situacao-${candidato.inscricao}`}>
        <Badge status={badgeDaSituacao(candidato)} />
        {candidato.empate_pendente && <span style={estiloMarcador}>Empate a resolver</span>}
        {candidato.desistencia && (
          <span style={estiloMarcador}>Motivo: {candidato.desistencia.motivo}</span>
        )}
        {candidato.indicacao?.justificativa && (
          <span style={estiloMarcador}>Justificativa: {candidato.indicacao.justificativa}</span>
        )}
      </div>
    )
  }

  const linhas = candidatos.map((candidato) => [
    candidato.posicao ? `${candidato.posicao}º` : '',
    <div key={`nome-${candidato.inscricao}`}>
      {candidato.aluno_nome}
      <span style={estiloMarcador}>{candidato.aluno_email}</span>
    </div>,
    ...etapas.map((etapa) => candidato.notas[etapa.id] ?? 'Sem nota'),
    <strong key={`final-${candidato.inscricao}`}>{candidato.nota_final ?? 'Pendente'}</strong>,
    situacao(candidato),
    <AcoesCell key={`acoes-${candidato.inscricao}`} acoes={acoes(candidato)} />,
  ])

  return (
    <>
      <div style={estiloResumo}>
        <div>
          <strong>Vagas:</strong> {bolsa.quantidade_vagas}
        </div>
        <div>
          <strong>Nota mínima:</strong> {bolsa.nota_minima ?? 'Não definida'}
        </div>
        <div>
          <strong>Etapas:</strong>{' '}
          {etapas.length
            ? etapas
                .map((etapa) => `${etapa.nome} (${formatarPeso(etapa.peso_efetivo)})`)
                .join(', ')
            : 'Nenhuma etapa cadastrada'}
        </div>
        <div>
          <strong>Status:</strong>{' '}
          <Badge status={publicado ? 'RESULTADO_PUBLICADO' : bolsa.status} />
        </div>
        {publicado && (
          <div>
            <strong>Bolsistas indicados:</strong> {consulta.dados.vagas_preenchidas} de{' '}
            {bolsa.quantidade_vagas}
          </div>
        )}
      </div>

      {!publicado && consulta.dados.motivo_bloqueio_notas && (
        <Alert tone="warning">{consulta.dados.motivo_bloqueio_notas}</Alert>
      )}
      {!publicado && podeLancar && consulta.dados.pendencias_publicacao.length > 0 && (
        <Alert tone="warning">
          Para publicar o resultado:
          <ul className="mt-1 pl-5">
            {consulta.dados.pendencias_publicacao.map((pendencia) => (
              <li key={pendencia}>{pendencia}</li>
            ))}
          </ul>
        </Alert>
      )}
      {publicado && (
        <Alert tone="success">
          Resultado publicado em {new Date(consulta.dados.publicado_em).toLocaleString('pt-BR')}. As
          notas estão bloqueadas. Os titulares são indicados direto; se um titular não for assumir,
          registre em &quot;Não vai assumir&quot; para liberar a vaga a um suplente. Indicar um
          suplente fora da ordem exige justificativa.
        </Alert>
      )}

      <div className="mb-3 flex justify-end gap-2">
        {!publicado &&
          gruposEmpate.map((grupo) => (
            <Button key={grupo[0].nota_final} variant="outline" onClick={() => setEmpatados(grupo)}>
              Desempatar nota {grupo[0].nota_final}
            </Button>
          ))}
        {publicado ? (
          <Button variant="outline" onClick={() => setVerResultado(true)}>
            Ver resultado publicado
          </Button>
        ) : (
          <Button variant="accent" onClick={publicar} disabled={!consulta.dados.pode_publicar}>
            Publicar resultado
          </Button>
        )}
      </div>

      <DataTable
        columns={[
          'Pos.',
          'Candidato',
          ...etapas.map((etapa) => etapa.nome),
          'Nota final',
          'Situação',
          'Ações',
        ]}
        rows={linhas}
        emptyMessage="Nenhum candidato homologado nesta bolsa."
      />

      {notasDe && (
        <LancarNotasModal
          bolsaId={bolsaId}
          candidato={notasDe}
          etapas={etapas}
          onFechar={() => setNotasDe(null)}
          onSalvo={(dados) => {
            setNotasDe(null)
            atualizar(dados, 'Notas salvas.')
          }}
        />
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
