import { useState } from 'react'
import { selecaoFetch } from '../api'
import { Alert, Button, FormActions, Modal } from '../components'
import { mensagemDeErro } from '../utils/mensagemDeErro'

/**
 * Candidatos com a mesma nota final: o coordenador define a ordem entre eles.
 */
export default function DesempateModal({ bolsaId, empatados, onSalvo, onFechar }) {
  const [ordem, setOrdem] = useState(empatados)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function mover(indice, deslocamento) {
    setOrdem((atual) => {
      const copia = [...atual]
      const [item] = copia.splice(indice, 1)
      copia.splice(indice + deslocamento, 0, item)
      return copia
    })
  }

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      const res = await selecaoFetch(`/bolsas/${bolsaId}/desempate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inscricoes: ordem.map((candidato) => candidato.inscricao) }),
      })
      const dados = await res.json().catch(() => null)
      if (!res.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível salvar o desempate.'))
      onSalvo(dados)
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal title={`Desempate: nota ${empatados[0].nota_final}`} onClose={onFechar} width={480}>
      {erro && <Alert tone="error">{erro}</Alert>}
      <p className="mb-3">
        Estes candidatos têm a mesma nota final. Ordene-os conforme o critério de desempate adotado
        (o primeiro da lista fica à frente na classificação).
      </p>

      <ol className="grid list-none gap-2">
        {ordem.map((candidato, indice) => (
          <li
            key={candidato.inscricao}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
          >
            <strong className="w-6">{indice + 1}º</strong>
            <span className="flex-1">{candidato.aluno_nome}</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={indice === 0 || salvando}
              onClick={() => mover(indice, -1)}
            >
              ↑
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={indice === ordem.length - 1 || salvando}
              onClick={() => mover(indice, 1)}
            >
              ↓
            </Button>
          </li>
        ))}
      </ol>

      <FormActions>
        <Button variant="outline" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button variant="accent" onClick={salvar} loading={salvando}>
          Salvar ordem
        </Button>
      </FormActions>
    </Modal>
  )
}
