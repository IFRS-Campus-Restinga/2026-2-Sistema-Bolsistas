import { useState } from 'react'
import { inscricoesFetch } from '../api'
import {
  Alert,
  Button,
  EmptyState,
  FormActions,
  FormField,
  IconFileText,
  IconGavel,
  Modal,
  StatusPill,
  TextArea,
  useToast,
} from '../components'
import { formatarDataHora } from '../utils/dataHora'
import { mensagemDeErro } from '../utils/mensagemDeErro'

/** Etapa Recursos da seleção: recursos de homologação da bolsa e o julgamento. */
export default function EtapaRecursos({ recursos, onMudou }) {
  const toast = useToast()
  const [julgando, setJulgando] = useState(null) // { recurso, deferir }
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  if (recursos.length === 0) {
    return (
      <EmptyState
        compact
        icon={<IconGavel />}
        title="Nenhum recurso nesta bolsa"
        description="Candidatos indeferidos podem interpor recurso no período definido pelo edital."
      />
    )
  }

  function abrir(recurso, deferir) {
    setJulgando({ recurso, deferir })
    setTexto('')
    setErro('')
  }

  async function confirmar() {
    setSalvando(true)
    setErro('')
    try {
      const response = await inscricoesFetch(`/recursos/${julgando.recurso.id}/julgar/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisao: julgando.deferir ? 'DEFERIDO' : 'INDEFERIDO',
          justificativa: texto,
        }),
      })
      const dados = await response.json().catch(() => null)
      if (!response.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível julgar o recurso.'))
      setJulgando(null)
      toast({ message: 'Julgamento registrado. O aluno foi notificado.', tone: 'success' })
      onMudou?.()
    } catch (error) {
      setErro(error.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {recursos.map((recurso) => (
        <div key={recurso.id} className="rounded-controle border border-gray-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-gray-900">{recurso.aluno_nome}</div>
              <div className="text-xs text-gray-500">
                Interposto {formatarDataHora(recurso.criado_em)}
              </div>
            </div>
            {/* Expirado: o prazo do aluno acabou, mas o recurso ainda aguarda julgamento. */}
            {['PENDENTE', 'EXPIRADO'].includes(recurso.status) ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => abrir(recurso, false)}>
                  Indeferir
                </Button>
                <Button size="sm" variant="accent" onClick={() => abrir(recurso, true)}>
                  Deferir
                </Button>
              </div>
            ) : (
              <StatusPill status={recurso.status} />
            )}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Motivo do indeferimento</div>
              <p className="mt-0.5 text-sm text-gray-700">{recurso.motivo_contestado || '—'}</p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Argumento do candidato</div>
              <p className="mt-0.5 text-sm text-gray-700">{recurso.justificativa}</p>
            </div>
          </div>
          {recurso.anexos.map((anexo) => (
            <a
              key={anexo.id}
              href={anexo.arquivo}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1.5 text-xs text-gray-600 no-underline hover:text-gray-900"
            >
              <IconFileText size={14} /> {anexo.nome_original}
            </a>
          ))}
          {recurso.justificativa_julgamento && (
            <p className="mt-3 text-sm text-gray-600">
              <span className="text-gray-400">Decisão: </span>
              {recurso.justificativa_julgamento}
            </p>
          )}
        </div>
      ))}

      {julgando && (
        <Modal
          title={julgando.deferir ? 'Deferir recurso' : 'Indeferir recurso'}
          description={
            julgando.deferir ? 'A inscrição será homologada.' : 'A inscrição permanece indeferida.'
          }
          onClose={() => !salvando && setJulgando(null)}
        >
          {erro && <Alert tone="error">{erro}</Alert>}
          <FormField label="Justificativa">
            <TextArea rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </FormField>
          <FormActions>
            <Button onClick={() => setJulgando(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              variant={julgando.deferir ? 'accent' : 'danger'}
              disabled={!texto.trim()}
              loading={salvando}
              onClick={confirmar}
            >
              Confirmar
            </Button>
          </FormActions>
        </Modal>
      )}
    </div>
  )
}
