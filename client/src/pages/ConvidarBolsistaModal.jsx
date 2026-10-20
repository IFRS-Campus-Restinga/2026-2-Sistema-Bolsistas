import { useEffect, useRef, useState } from 'react'
import { vinculoDiretoFetch } from '../api'
import { Alert, Button, FormActions, FormField, Modal, Spinner, TextInput } from '../components'

function extrairErro(corpo, mensagemPadrao) {
  if (!corpo) return mensagemPadrao
  return (
    corpo.detail ||
    corpo.bolsa?.[0] ||
    corpo.aluno?.[0] ||
    corpo.non_field_errors?.[0] ||
    mensagemPadrao
  )
}

export default function ConvidarBolsistaModal({ bolsa, onFechar, onCriado }) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [alunoSelecionado, setAlunoSelecionado] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const ultimaBusca = useRef(0)

  const buscaValida = termo.trim().length >= 3

  useEffect(() => {
    if (alunoSelecionado || !buscaValida) return undefined
    const minhaBusca = ++ultimaBusca.current
    const timer = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await vinculoDiretoFetch(`/alunos-busca/?q=${encodeURIComponent(termo.trim())}`)
        const dados = await res.json().catch(() => [])
        if (ultimaBusca.current === minhaBusca) setResultados(Array.isArray(dados) ? dados : [])
      } finally {
        if (ultimaBusca.current === minhaBusca) setBuscando(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [termo, alunoSelecionado, buscaValida])

  async function enviarConvite() {
    setEnviando(true)
    setErro('')
    try {
      const res = await vinculoDiretoFetch('/convites/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bolsa: bolsa.id, aluno: alunoSelecionado.id }),
      })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extrairErro(corpo, 'Não foi possível enviar o convite.'))
      onCriado(corpo)
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal title="Convidar Bolsista" onClose={onFechar} width={520}>
      {erro && <Alert tone="error">{erro}</Alert>}

      <p style={{ marginBottom: 16 }}>
        Convite de vínculo direto para a bolsa do projeto <strong>{bolsa.projeto_titulo}</strong> (
        {bolsa.edital_link_documento_oficial ? (
          <a href={bolsa.edital_link_documento_oficial} target="_blank" rel="noopener noreferrer">
            {bolsa.edital_nome}
          </a>
        ) : (
          bolsa.edital_nome
        )}
        ).
      </p>

      {alunoSelecionado ? (
        <FormField label="Aluno selecionado">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 10,
            }}
          >
            <div>
              <strong>{alunoSelecionado.nome}</strong>
              <div style={{ fontSize: 13, color: '#6b7280' }}>{alunoSelecionado.email}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAlunoSelecionado(null)}>
              Trocar
            </Button>
          </div>
        </FormField>
      ) : (
        <FormField label="Buscar aluno (nome ou e-mail)">
          <TextInput
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Digite ao menos 3 caracteres..."
            autoFocus
          />
          {buscando && (
            <p
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: '#6b7280',
              }}
            >
              <Spinner size={12} /> Buscando...
            </p>
          )}
          {!buscando && buscaValida && resultados.length === 0 && (
            <p style={{ fontSize: 13, color: '#6b7280' }}>Nenhum aluno encontrado.</p>
          )}
          {buscaValida && resultados.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
              {resultados.map((aluno) => (
                <li key={aluno.id}>
                  <button
                    type="button"
                    onClick={() => setAlunoSelecionado(aluno)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 8,
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      marginBottom: 4,
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <strong>{aluno.nome}</strong>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{aluno.email}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </FormField>
      )}

      <FormActions>
        <Button variant="danger" onClick={onFechar} disabled={enviando}>
          Cancelar
        </Button>
        <Button
          variant="accent"
          onClick={enviarConvite}
          disabled={!alunoSelecionado}
          loading={enviando}
        >
          Enviar Convite
        </Button>
      </FormActions>
    </Modal>
  )
}
