import { useEffect, useState } from 'react'
import { bolsasFetch } from '../api'
import { Alert, Button, FormField, PageHeader, Select } from '../components'
import ClassificacaoBolsa from './ClassificacaoBolsa'

const STATUS_EM_SELECAO = ['ABERTA', 'EM_SELECAO', 'PREENCHIDA']

export default function SelecaoPage() {
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
        if (ativo) setBolsas(dados.filter((bolsa) => STATUS_EM_SELECAO.includes(bolsa.status)))
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
    `${bolsa.projeto_titulo} · ${bolsa.edital_nome} · ${bolsa.modalidade} · ${bolsa.carga_horaria_semanal}h · ${bolsa.status_display}`

  function atualizarStatus(resumo) {
    setBolsas((atuais) =>
      atuais.map((bolsa) =>
        bolsa.id === resumo.id
          ? { ...bolsa, status: resumo.status, status_display: resumo.status_display }
          : bolsa
      )
    )
  }

  return (
    <>
      <PageHeader title="Avaliação e Seleção" />
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
              {bolsas.map((bolsa) => (
                <option key={bolsa.id} value={bolsa.id}>
                  {descricao(bolsa)}
                </option>
              ))}
            </Select>
          </FormField>
          {!bolsas.length && <p>Nenhuma bolsa aberta ou em seleção.</p>}
          {bolsaId && (
            <ClassificacaoBolsa
              key={bolsaId}
              bolsaId={Number(bolsaId)}
              onAtualizada={atualizarStatus}
            />
          )}
        </>
      )}
    </>
  )
}
