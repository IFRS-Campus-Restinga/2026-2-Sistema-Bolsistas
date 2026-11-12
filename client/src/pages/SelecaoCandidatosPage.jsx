import { useEffect, useState } from 'react'
import { bolsasFetch, inscricoesFetch, selecaoFetch } from '../api'
import {
  Alert,
  BolsaPicker,
  Button,
  Carregando,
  EmptyState,
  IconFunnel,
  PageHeader,
  Stepper,
  StatusPill,
  Tabs,
} from '../components'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import EtapaInscritos from './EtapaInscritos'
import EtapaNotas from './EtapaNotas'
import EtapaRecursos from './EtapaRecursos'
import EtapaResultado from './EtapaResultado'

// Só bolsas aprovadas pela coordenação de área com vaga a preencher; as preenchidas saem.
const STATUS_EM_SELECAO = ['ABERTA', 'EM_SELECAO']

const ETAPAS = ['inscritos', 'recursos', 'notas', 'resultado']
const NOMES_DO_STEPPER = ['Homologação', 'Recursos', 'Notas', 'Resultado']

// Expirado: o prazo do aluno acabou, mas o recurso ainda aguarda julgamento.
const aguardaJulgamento = (recurso) => ['PENDENTE', 'EXPIRADO'].includes(recurso.status)

/** Recursos e classificação da bolsa escolhida, usados nas etapas Recursos, Notas e Resultado. */
function useDetalheDaBolsa(bolsaId, versao) {
  const [detalhe, setDetalhe] = useState({ carregando: true, recursos: [], classificacao: null })

  useEffect(() => {
    if (!bolsaId) return undefined
    let ativo = true
    async function carregar() {
      try {
        const [rRecursos, rClassificacao] = await Promise.all([
          inscricoesFetch(`/recursos/?bolsa=${bolsaId}`),
          selecaoFetch(`/bolsas/${bolsaId}/classificacao/`),
        ])
        const [recursos, classificacao] = await Promise.all(
          [rRecursos, rClassificacao].map((r) => r.json().catch(() => null))
        )
        if (!rClassificacao.ok) {
          throw new Error(mensagemDeErro(classificacao, 'Não foi possível carregar a seleção.'))
        }
        if (ativo) {
          setDetalhe({
            carregando: false,
            recursos: Array.isArray(recursos) ? recursos : [],
            classificacao,
            erro: '',
          })
        }
      } catch (error) {
        if (ativo) {
          setDetalhe({ carregando: false, recursos: [], classificacao: null, erro: error.message })
        }
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [bolsaId, versao])

  return [detalhe, (classificacao) => setDetalhe((atual) => ({ ...atual, classificacao }))]
}

/**
 * Seleção de candidatos: homologação, recursos, notas e resultado de uma bolsa numa só
 * tela, em etapas (antes eram as tabs Meus Candidatos e Avaliação e Seleção).
 */
export default function SelecaoCandidatosPage() {
  const [bolsas, setBolsas] = useState([])
  const [bolsaId, setBolsaId] = useState(null)
  const [etapa, setEtapa] = useState('inscritos')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)
  const [detalhe, setClassificacao] = useDetalheDaBolsa(bolsaId, versao)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const res = await bolsasFetch('/')
        if (!res.ok) throw new Error('Não foi possível carregar suas bolsas.')
        const dados = await res.json()
        if (!Array.isArray(dados)) throw new Error('Lista de bolsas inválida.')
        if (ativo) {
          const emSelecao = dados.filter((bolsa) => STATUS_EM_SELECAO.includes(bolsa.status))
          setBolsas(emSelecao)
          setErro('')
          // Como no protótipo, a primeira bolsa já vem escolhida.
          setBolsaId((atual) => atual ?? emSelecao[0]?.id ?? null)
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
  }, [versao])

  // Uma decisão (homologação, recurso, notas, indicação) muda contadores e status:
  // recarrega a lista de bolsas e os dados da bolsa escolhida.
  const recarregar = () => setVersao((atual) => atual + 1)

  function atualizarClassificacao(dados) {
    setClassificacao(dados)
    recarregar()
  }

  const selecionada = bolsas.find((bolsa) => bolsa.id === bolsaId)
  const recursosPendentes = detalhe.recursos.filter(aguardaJulgamento).length
  const detalheCarregado = !detalhe.carregando && !detalhe.erro

  return (
    <>
      <PageHeader
        title="Seleção de candidatos"
        description="Escolha uma bolsa para fazer a homologação das inscrições, julgar recursos, lançar notas e indicar bolsistas."
      />

      {carregando ? (
        <Carregando texto="Carregando bolsas..." />
      ) : erro ? (
        <>
          <Alert tone="error">{erro}</Alert>
          <Button onClick={recarregar}>Tentar novamente</Button>
        </>
      ) : bolsas.length === 0 ? (
        <EmptyState icon={<IconFunnel />} title="Nenhuma bolsa com seleção em andamento" />
      ) : (
        <>
          <BolsaPicker
            bolsas={bolsas}
            value={bolsaId}
            onChange={(id) => {
              setBolsaId(id)
              setEtapa('inscritos')
            }}
            meta={(bolsa) => (
              <span className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {bolsa.total_inscritos} {bolsa.total_inscritos === 1 ? 'inscrito' : 'inscritos'}
                </span>
                {bolsa.inscricoes_pendentes > 0 && (
                  <StatusPill
                    label={`${bolsa.inscricoes_pendentes} a analisar`}
                    tone="warning"
                    size="sm"
                  />
                )}
              </span>
            )}
          />

          {selecionada && (
            <div className="mt-6 rounded-card border border-gray-200 bg-white shadow-card">
              <div className="border-b border-gray-100 px-5 pt-4">
                <div className="mb-4 max-w-2xl">
                  <Stepper steps={NOMES_DO_STEPPER} current={ETAPAS.indexOf(etapa)} />
                </div>
                <Tabs
                  value={etapa}
                  onChange={setEtapa}
                  tabs={[
                    { id: 'inscritos', label: 'Inscritos', count: selecionada.total_inscritos },
                    { id: 'recursos', label: 'Recursos', count: recursosPendentes },
                    { id: 'notas', label: 'Notas' },
                    { id: 'resultado', label: 'Resultado' },
                  ]}
                />
              </div>
              <div className="p-5">
                {etapa === 'inscritos' && (
                  <EtapaInscritos key={selecionada.id} bolsa={selecionada} onMudou={recarregar} />
                )}
                {etapa !== 'inscritos' && detalhe.carregando && (
                  <Carregando texto="Carregando..." />
                )}
                {etapa !== 'inscritos' && detalhe.erro && (
                  <Alert tone="error">{detalhe.erro}</Alert>
                )}
                {etapa === 'recursos' && detalheCarregado && (
                  <EtapaRecursos recursos={detalhe.recursos} onMudou={recarregar} />
                )}
                {etapa === 'notas' && detalheCarregado && (
                  <EtapaNotas
                    key={selecionada.id}
                    bolsaId={selecionada.id}
                    classificacao={detalhe.classificacao}
                    onAtualizada={atualizarClassificacao}
                  />
                )}
                {etapa === 'resultado' && detalheCarregado && (
                  <EtapaResultado
                    bolsaId={selecionada.id}
                    classificacao={detalhe.classificacao}
                    onAtualizada={atualizarClassificacao}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
