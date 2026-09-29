import { useEffect, useState } from 'react'
import { bolsasFetch } from '../api'
import { Alert, Button, FormField, PageHeader, Select } from '../components'
import CandidatosPage from './CandidatosPage'

export default function MeusCandidatosPage() {
  const [bolsas, setBolsas] = useState([])
  const [bolsaId, setBolsaId] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        const res = await bolsasFetch('/')
        if (!res.ok) throw new Error('Não foi possível carregar suas bolsas.')
        const dados = await res.json()
        if (!Array.isArray(dados)) throw new Error('Lista de bolsas inválida.')
        if (ativo) setBolsas(dados)
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
  }, [tentativa])

  const descricao = (bolsa) =>
    `${bolsa.projeto_titulo} · ${bolsa.edital_nome} · ${bolsa.tipo_display} · ${bolsa.modalidade} · ${bolsa.carga_horaria_semanal}h · R$ ${bolsa.valor_mensal}`

  const filtradas = bolsas

  const selecionada = filtradas.find((bolsa) => String(bolsa.id) === bolsaId)

  return (
    <>
      <PageHeader title="Candidatos por Bolsa" />
      {carregando ? (
        <p role="status">Carregando bolsas...</p>
      ) : erro ? (
        <>
          <Alert tone="error">{erro}</Alert>
          <Button onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</Button>
        </>
      ) : (
        <>
          <FormField label="Selecione a bolsa">
            <Select
              aria-label="Selecione a bolsa"
              value={bolsaId}
              onChange={(e) => setBolsaId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {filtradas.map((bolsa) => (
                <option key={bolsa.id} value={bolsa.id}>
                  {descricao(bolsa)}
                </option>
              ))}
            </Select>
          </FormField>
          {!filtradas.length && <p>Nenhuma bolsa encontrada.</p>}
          {selecionada && <CandidatosPage key={selecionada.id} bolsa={selecionada} />}
        </>
      )}
    </>
  )
}
