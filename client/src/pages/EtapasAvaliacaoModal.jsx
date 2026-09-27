import { useState } from 'react'
import { bolsasFetch } from '../api'
import {
  Alert,
  Button,
  DataTable,
  FormActions,
  FormField,
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
 * Cadastro das etapas de avaliação de uma bolsa e dos pesos (%) de cada uma.
 *
 * Regra dos pesos (calculada no backend, campo `peso_efetivo`):
 *   - etapa com peso definido usa esse peso;
 *   - etapas sem peso dividem igualmente o que sobra de 100%
 *     (então, se nenhuma tem peso, todas ficam com o mesmo peso).
 *
 * Props:
 *   bolsa        — bolsa vinda da API (com `etapas`, `aviso_pesos` e `pode_editar`)
 *   onAtualizada — callback(bolsa) com a bolsa recarregada depois de cada alteração
 *   onFechar
 */
export default function EtapasAvaliacaoModal({ bolsa: bolsaInicial, onAtualizada, onFechar }) {
  const confirmar = useConfirm()

  const [bolsa, setBolsa] = useState(bolsaInicial)
  const [form, setForm] = useState(ETAPA_VAZIA)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const etapas = bolsa.etapas || []
  const editando = form.id !== null
  const podeEditar = bolsa.pode_editar

  async function recarregarBolsa() {
    const res = await bolsasFetch(`/${bolsa.id}/`)
    if (!res.ok) return
    const atualizada = await res.json()
    setBolsa(atualizada)
    onAtualizada(atualizada)
  }

  function atualizarCampo(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function limparFormulario() {
    setForm(ETAPA_VAZIA)
    setErro('')
  }

  function editarEtapa(etapa) {
    setForm({
      id: etapa.id,
      nome: etapa.nome,
      peso: etapa.peso ?? '',
      dataHora: isoParaInputLocal(etapa.data_hora),
      local: etapa.local || '',
    })
    setErro('')
  }

  async function salvarEtapa() {
    setSalvando(true)
    setErro('')
    try {
      const url = editando ? `/${bolsa.id}/etapas/${form.id}/` : `/${bolsa.id}/etapas/`
      const res = await bolsasFetch(url, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          peso: form.peso === '' ? null : form.peso,
          data_hora: inputLocalParaIso(form.dataHora),
          local: form.local,
        }),
      })
      if (!res.ok) {
        const corpo = await res.json().catch(() => null)
        throw new Error(mensagemDeErro(corpo, 'Erro ao salvar a etapa.'))
      }
      setForm(ETAPA_VAZIA)
      await recarregarBolsa()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
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
        if (form.id === etapa.id) setForm(ETAPA_VAZIA)
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
        <Button size="sm" variant="outline" onClick={() => editarEtapa(etapa)}>
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

  const pesoInvalido =
    form.peso !== '' &&
    (Number.isNaN(Number(form.peso)) || Number(form.peso) <= 0 || Number(form.peso) > 100)

  return (
    <Modal title={`Etapas de avaliação — ${bolsa.edital_nome}`} onClose={onFechar} width={680}>
      <p style={{ margin: '0 0 12px', color: '#4b5563', fontSize: 14 }}>
        Etapas sem peso dividem igualmente o que sobra de 100%. Se nenhuma etapa tiver peso, todas
        ficam com o mesmo peso.
      </p>

      {!podeEditar && (
        <Alert tone="warning">
          Esta bolsa não pode mais ser alterada (fora do prazo de inscrições ou status encerrado).
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
        <p style={{ textAlign: 'right', margin: '8px 0 16px', color: '#4b5563' }}>
          <strong>Total:</strong> {formatarPeso(somaEfetiva)}
        </p>
      )}

      {podeEditar && (
        <>
          <h4 style={{ margin: '8px 0' }}>{editando ? 'Editar etapa' : 'Nova etapa'}</h4>

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
          {pesoInvalido && (
            <Alert tone="error">O peso deve ser maior que 0% e no máximo 100%.</Alert>
          )}

          <FormField label="Data e hora (opcional)">
            <TextInput
              type="datetime-local"
              value={form.dataHora}
              onChange={(e) => atualizarCampo('dataHora', e.target.value)}
            />
          </FormField>

          <FormField label="Local ou link da reunião online (opcional)">
            <TextInput
              value={form.local}
              maxLength={255}
              placeholder="Sala 204 ou https://meet.google.com/..."
              onChange={(e) => atualizarCampo('local', e.target.value)}
            />
          </FormField>

          <FormActions>
            {editando && (
              <Button variant="outline" onClick={limparFormulario} disabled={salvando}>
                Cancelar edição
              </Button>
            )}
            <Button
              variant="accent"
              onClick={salvarEtapa}
              disabled={salvando || !form.nome.trim() || pesoInvalido}
            >
              {salvando ? 'Salvando...' : editando ? 'Salvar etapa' : 'Adicionar etapa'}
            </Button>
          </FormActions>
        </>
      )}
    </Modal>
  )
}
