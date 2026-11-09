import { useState } from 'react'
import { bolsasFetch } from '../api'
import {
  Alert,
  Button,
  EmptyState,
  FormActions,
  FormField,
  Hint,
  IconClock,
  IconPlus,
  Progress,
  TextInput,
  useConfirm,
} from '../components'
import { formatarDataHora, inputLocalParaIso, isoParaInputLocal } from '../utils/dataHora'

const ETAPA_VAZIA = { id: null, nome: '', peso: '', dataHora: '', local: '' }

function mensagemDeErro(corpo, padrao) {
  return (
    corpo?.nome?.[0] ||
    corpo?.peso?.[0] ||
    corpo?.data_hora?.[0] ||
    corpo?.local?.[0] ||
    corpo?.non_field_errors?.[0] ||
    corpo?.detail ||
    padrao
  )
}

const formatarPercentual = (valor) => `${Number(valor || 0).toLocaleString('pt-BR')}%`

/** Formulário embutido de uma etapa (nova ou em edição). */
function EtapaForm({ bolsaId, inicial, onCancelar, onSalva }) {
  const [form, setForm] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const editando = form.id !== null
  // Sem mudança na data, manda a original (evita diferença de segundos no ISO).
  const dataMudou = form.dataHora !== inicial.dataHora

  const atualizar = (campo) => (evento) =>
    setForm((atual) => ({ ...atual, [campo]: evento.target.value }))

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      const url = editando ? `/${bolsaId}/etapas/${form.id}/` : `/${bolsaId}/etapas/`
      const peso = String(form.peso).trim().replace(',', '.')
      const res = await bolsasFetch(url, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          peso: peso === '' ? null : peso,
          ...(dataMudou || !editando ? { data_hora: inputLocalParaIso(form.dataHora) } : {}),
          local: form.local,
        }),
      })
      if (!res.ok) {
        const corpo = await res.json().catch(() => null)
        throw new Error(mensagemDeErro(corpo, 'Não foi possível salvar a etapa.'))
      }
      await onSalva()
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
      <p className="mb-3 text-sm font-semibold text-gray-900">
        {editando ? 'Editar etapa' : 'Nova etapa'}
      </p>
      {erro && <Alert tone="error">{erro}</Alert>}
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <FormField label="Nome da etapa">
            <TextInput
              value={form.nome}
              maxLength={100}
              onChange={atualizar('nome')}
              placeholder="Ex.: Entrevista"
            />
          </FormField>
        </div>
        <FormField label="Peso (%)" hint="Opcional">
          <TextInput
            inputMode="decimal"
            value={form.peso}
            onChange={atualizar('peso')}
            placeholder="Igual"
          />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <FormField label="Data e hora" hint="Opcional; não pode estar no passado.">
          <TextInput type="datetime-local" value={form.dataHora} onChange={atualizar('dataHora')} />
        </FormField>
        <FormField label="Local ou link da reunião" hint="Opcional">
          <TextInput
            value={form.local}
            maxLength={255}
            onChange={atualizar('local')}
            placeholder="Sala 204 ou https://…"
          />
        </FormField>
      </div>
      <FormActions>
        <Button onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button variant="primary" disabled={!form.nome.trim()} loading={salvando} onClick={salvar}>
          {editando ? 'Salvar etapa' : 'Adicionar etapa'}
        </Button>
      </FormActions>
    </div>
  )
}

/**
 * Etapas de avaliação da bolsa no painel lateral, como no protótipo: só depois da
 * aprovação e até o fim das inscrições; peso em % opcional, e as etapas sem peso dividem
 * igualmente o que sobra de 100% (regras em bolsas/models.py).
 */
export default function EtapasEditor({ bolsa, onAtualizada }) {
  const confirmar = useConfirm()
  const [form, setForm] = useState(null) // null = formulário fechado
  const [erro, setErro] = useState('')
  const etapas = bolsa.etapas || []
  const editavel = bolsa.pode_editar_etapas
  const total = etapas.reduce((soma, etapa) => soma + Number(etapa.peso_efetivo || 0), 0)

  async function recarregar() {
    const res = await bolsasFetch(`/${bolsa.id}/`)
    if (res.ok) onAtualizada(await res.json())
  }

  function abrir(etapa) {
    setErro('')
    setForm(
      etapa
        ? {
            id: etapa.id,
            nome: etapa.nome,
            peso: etapa.peso ?? '',
            dataHora: isoParaInputLocal(etapa.data_hora),
            local: etapa.local || '',
          }
        : ETAPA_VAZIA
    )
  }

  function remover(etapa) {
    confirmar({
      title: 'Remover etapa',
      message: `Remover a etapa "${etapa.nome}"? Os pesos das etapas sem peso definido serão recalculados.`,
      confirmLabel: 'Remover',
      tone: 'danger',
      onConfirm: async () => {
        setErro('')
        const res = await bolsasFetch(`/${bolsa.id}/etapas/${etapa.id}/`, { method: 'DELETE' })
        if (!res.ok) {
          const corpo = await res.json().catch(() => null)
          setErro(mensagemDeErro(corpo, 'Não foi possível remover a etapa.'))
          return
        }
        await recarregar()
      },
    })
  }

  if (bolsa.status === 'SOLICITADA') {
    return (
      <section>
        <p className="mb-2 text-xs font-medium text-gray-500">Etapas de avaliação</p>
        <EmptyState
          compact
          icon={<IconClock />}
          title="Etapas liberadas após a aprovação"
          description="Quando a coordenação de área aprovar a bolsa, você define aqui as etapas, os pesos e a agenda da seleção."
        />
      </section>
    )
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">Etapas de avaliação</p>
        {editavel && !form && (
          <Button size="sm" onClick={() => abrir(null)}>
            <IconPlus size={13} /> Adicionar etapa
          </Button>
        )}
      </div>
      {editavel && (
        <Hint>Peso em % é opcional: etapas sem peso dividem igualmente o que sobra de 100%.</Hint>
      )}
      {!editavel && bolsa.motivo_bloqueio_etapas && (
        <p className="mb-2 text-xs text-gray-500">
          Somente leitura: {bolsa.motivo_bloqueio_etapas}
        </p>
      )}
      {bolsa.aviso_pesos && <Alert tone="warning">{bolsa.aviso_pesos}</Alert>}
      {erro && <Alert tone="error">{erro}</Alert>}

      {etapas.length === 0 && !form ? (
        <EmptyState
          compact
          title="Nenhuma etapa definida"
          description={
            editavel
              ? 'Adicione as etapas da seleção (ex.: análise de currículo, entrevista).'
              : undefined
          }
        />
      ) : (
        etapas.length > 0 && (
          <ul className="m-0 list-none divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 p-0">
            {etapas.map((etapa) => (
              <li key={etapa.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-gray-900">{etapa.nome}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {etapa.data_hora ? formatarDataHora(etapa.data_hora) : 'Sem data'}
                    {etapa.local && ` · ${etapa.local}`}
                  </span>
                </span>
                <span className="w-24 text-right">
                  <span className="block font-semibold text-gray-900 tabular-nums">
                    {formatarPercentual(etapa.peso_efetivo)}
                  </span>
                </span>
                {editavel && (
                  <span className="flex">
                    <Button size="sm" variant="ghost" onClick={() => abrir(etapa)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remover(etapa)}>
                      Remover
                    </Button>
                  </span>
                )}
              </li>
            ))}
            <li className="flex items-center gap-3 bg-gray-50/70 px-3 py-2 text-xs text-gray-600">
              <span className="flex-1">Total</span>
              <span className="w-32">
                <Progress
                  value={total}
                  max={100}
                  tone={Math.round(total) === 100 ? 'brand' : 'amber'}
                />
              </span>
              <span className="w-24 text-right font-semibold text-gray-900 tabular-nums">
                {formatarPercentual(total)}
              </span>
              {editavel && <span className="w-[132px]" />}
            </li>
          </ul>
        )
      )}

      {form && (
        <EtapaForm
          key={form.id ?? 'nova'}
          bolsaId={bolsa.id}
          inicial={form}
          onCancelar={() => setForm(null)}
          onSalva={async () => {
            setForm(null)
            await recarregar()
          }}
        />
      )}
    </section>
  )
}
