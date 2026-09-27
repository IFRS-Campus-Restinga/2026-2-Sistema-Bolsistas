import { useState } from 'react'
import { bolsasFetch } from '../api'
import {
  Alert,
  Button,
  DataTable,
  FormActions,
  FormField,
  IconPlus,
  LocalEtapa,
  Modal,
  TextInput,
  useConfirm,
} from '../components'
import { formatarDataHora, inputLocalParaIso, isoParaInputLocal } from '../utils/dataHora'
import { formatarPeso } from '../utils/formatarPeso'

const ETAPA_VAZIA = { id: null, nome: '', peso: '', dataHora: '', local: '' }

function mensagemDeErro(corpo, padrao) {
  return (
    corpo?.nome?.[0] ||
    corpo?.peso?.[0] ||
    corpo?.data_hora?.[0] ||
    corpo?.local?.[0] ||
    corpo?.detail ||
    padrao
  )
}

/**
 * Lista das etapas de avaliação de uma bolsa. Criar/editar abre um segundo
 * modal por cima (EtapaFormModal).
 *
 * Regra dos pesos (calculada no backend, campo `peso_efetivo`):
 *   - etapa com peso definido usa esse peso;
 *   - etapas sem peso dividem igualmente o que sobra de 100%
 *     (então, se nenhuma tem peso, todas ficam com o mesmo peso).
 *
 * Props:
 *   bolsa        — bolsa vinda da API (com `etapas`, `aviso_pesos` e `pode_editar_etapas`)
 *   onAtualizada — callback(bolsa) com a bolsa recarregada depois de cada alteração
 *   onFechar
 */
export default function EtapasAvaliacaoModal({ bolsa: bolsaInicial, onAtualizada, onFechar }) {
  const confirmar = useConfirm()

  const [bolsa, setBolsa] = useState(bolsaInicial)
  const [etapaEmEdicao, setEtapaEmEdicao] = useState(null) // null = form fechado
  const [erro, setErro] = useState('')

  const etapas = bolsa.etapas || []
  const podeEditar = bolsa.pode_editar_etapas

  async function recarregarBolsa() {
    const res = await bolsasFetch(`/${bolsa.id}/`)
    if (!res.ok) return
    const atualizada = await res.json()
    setBolsa(atualizada)
    onAtualizada(atualizada)
  }

  function abrirNovaEtapa() {
    setErro('')
    setEtapaEmEdicao(ETAPA_VAZIA)
  }

  function abrirEdicao(etapa) {
    setErro('')
    setEtapaEmEdicao({
      id: etapa.id,
      nome: etapa.nome,
      peso: etapa.peso ?? '',
      dataHora: isoParaInputLocal(etapa.data_hora),
      local: etapa.local || '',
    })
  }

  function excluirEtapa(etapa) {
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
          setErro(mensagemDeErro(corpo, 'Erro ao remover a etapa.'))
          return
        }
        await recarregarBolsa()
      },
    })
  }

  const somaEfetiva = etapas.reduce((total, etapa) => total + Number(etapa.peso_efetivo || 0), 0)

  const linhas = etapas.map((etapa) => [
    etapa.nome,
    etapa.peso === null ? (
      <span style={{ color: '#9ca3af' }}>Igual</span>
    ) : (
      formatarPeso(etapa.peso)
    ),
    formatarPeso(etapa.peso_efetivo),
    formatarDataHora(etapa.data_hora),
    <LocalEtapa key="local" local={etapa.local} />,
    podeEditar ? (
      <div key="acoes" style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        <Button size="sm" variant="outline" onClick={() => abrirEdicao(etapa)}>
          Editar
        </Button>
        <Button size="sm" variant="danger" onClick={() => excluirEtapa(etapa)}>
          Remover
        </Button>
      </div>
    ) : (
      <span key="acoes" style={{ color: '#9ca3af' }}>
        —
      </span>
    ),
  ])

  return (
    <>
      <Modal title={`Etapas de avaliação — ${bolsa.edital_nome}`} onClose={onFechar} width={760}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <p style={{ margin: 0, color: '#4b5563', fontSize: 14 }}>
            Etapas sem peso dividem igualmente o que sobra de 100%. Se nenhuma etapa tiver peso,
            todas ficam com o mesmo peso.
          </p>
          {podeEditar && (
            <div style={{ flexShrink: 0 }}>
              <Button variant="accent" onClick={abrirNovaEtapa}>
                <IconPlus /> Adicionar Etapa
              </Button>
            </div>
          )}
        </div>

        {!podeEditar && (
          <Alert tone="warning">
            As etapas desta bolsa não podem mais ser alteradas (fora do prazo de inscrições).
          </Alert>
        )}

        {bolsa.aviso_pesos && <Alert tone="warning">{bolsa.aviso_pesos}</Alert>}
        {erro && <Alert tone="error">{erro}</Alert>}

        <DataTable
          columns={['Etapa', 'Peso definido', 'Peso efetivo', 'Data e hora', 'Local', 'Ações']}
          rows={linhas}
          emptyMessage="Nenhuma etapa cadastrada."
        />

        {etapas.length > 0 && (
          <p style={{ textAlign: 'right', margin: '8px 0 0', color: '#4b5563' }}>
            <strong>Total:</strong> {formatarPeso(somaEfetiva)}
          </p>
        )}
      </Modal>

      {/* Irmão do modal da lista (e não filho), pra ficar por cima dele. */}
      {etapaEmEdicao && (
        <EtapaFormModal
          bolsaId={bolsa.id}
          etapaInicial={etapaEmEdicao}
          onFechar={() => setEtapaEmEdicao(null)}
          onSalva={async () => {
            setEtapaEmEdicao(null)
            await recarregarBolsa()
          }}
        />
      )}
    </>
  )
}

function agoraParaInputLocal() {
  return isoParaInputLocal(new Date().toISOString())
}

function EtapaFormModal({ bolsaId, etapaInicial, onFechar, onSalva }) {
  const [form, setForm] = useState(etapaInicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const editando = form.id !== null

  function atualizarCampo(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  const pesoInvalido =
    form.peso !== '' &&
    (Number.isNaN(Number(form.peso)) || Number(form.peso) <= 0 || Number(form.peso) > 100)

  // Uma etapa que já aconteceu pode ser editada sem trocar a data; só bloqueia
  // quando a data escolhida é nova e está no passado.
  const dataMudou = form.dataHora !== etapaInicial.dataHora
  const dataNoPassado = dataMudou && form.dataHora !== '' && new Date(form.dataHora) < new Date()

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      const url = editando ? `/${bolsaId}/etapas/${form.id}/` : `/${bolsaId}/etapas/`
      const res = await bolsasFetch(url, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          peso: form.peso === '' ? null : form.peso,
          // Sem mudança, manda a data original (evita diferença de segundos no ISO).
          ...(dataMudou || !editando ? { data_hora: inputLocalParaIso(form.dataHora) } : {}),
          local: form.local,
        }),
      })
      if (!res.ok) {
        const corpo = await res.json().catch(() => null)
        throw new Error(mensagemDeErro(corpo, 'Erro ao salvar a etapa.'))
      }
      await onSalva()
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    <Modal
      title={editando ? 'Editar Etapa de Avaliação' : 'Nova Etapa de Avaliação'}
      onClose={onFechar}
      width={480}
    >
      {erro && <Alert tone="error">{erro}</Alert>}

      <FormField label="Nome da etapa">
        <TextInput
          value={form.nome}
          maxLength={100}
          placeholder="Ex.: Entrevista, Análise de Currículo, Prova"
          onChange={(e) => atualizarCampo('nome', e.target.value)}
        />
      </FormField>

      <FormField label="Peso (%) — opcional; pesos iguais se nenhuma etapa definir">
        <TextInput
          type="number"
          step="0.01"
          min="0.01"
          max="100"
          value={form.peso}
          placeholder="Ex.: 40"
          onChange={(e) => atualizarCampo('peso', e.target.value)}
        />
      </FormField>
      {pesoInvalido && <Alert tone="error">O peso deve ser maior que 0% e no máximo 100%.</Alert>}

      <FormField label="Data e hora (opcional)">
        <TextInput
          type="datetime-local"
          min={agoraParaInputLocal()}
          value={form.dataHora}
          onChange={(e) => atualizarCampo('dataHora', e.target.value)}
        />
      </FormField>
      {dataNoPassado && (
        <Alert tone="error">A data e hora da etapa não pode estar no passado.</Alert>
      )}

      <FormField label="Local ou link da reunião online (opcional)">
        <TextInput
          value={form.local}
          maxLength={255}
          placeholder="Sala 204 ou https://meet.google.com/..."
          onChange={(e) => atualizarCampo('local', e.target.value)}
        />
      </FormField>

      <FormActions>
        <Button variant="outline" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button
          variant="accent"
          onClick={salvar}
          disabled={salvando || !form.nome.trim() || pesoInvalido || dataNoPassado}
        >
          {salvando ? 'Salvando...' : editando ? 'Salvar Etapa' : 'Adicionar Etapa'}
        </Button>
      </FormActions>
    </Modal>
  )
}
