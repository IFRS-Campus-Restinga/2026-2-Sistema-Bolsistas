import { useEffect, useState } from 'react'
import { editaisFetch } from '../api'
import { Alert, Button, Carregando, FormActions, Modal } from '../components'
import { formatarMoeda } from '../utils/formatarMoeda'
import { mensagemDeErro } from '../utils/mensagemDeErro'
import './ValoresBolsaModal.css'

function paraFormulario(item) {
  return { ...item, valor: item.valor_mensal ?? '' }
}

// Assinatura do que está selecionado, para saber se há algo a salvar.
function assinatura(itens) {
  return itens
    .filter((item) => item.disponivel)
    .map((item) => `${item.tipo_bolsa_modalidade}:${Number(item.valor)}`)
    .join('|')
}

function erroDoValor(item) {
  if (!item.disponivel) return ''
  if (item.valor === '') return 'Informe o valor.'
  if (Number(item.valor) <= 0) return 'O valor deve ser maior que zero.'
  if (Number(item.valor) > Number(item.valor_maximo)) {
    return `Acima do máximo de ${formatarMoeda(item.valor_maximo)}.`
  }
  return ''
}

function agruparPorModalidade(itens) {
  const grupos = []
  for (const item of itens) {
    let grupo = grupos.find((g) => g.modalidade === item.modalidade)
    if (!grupo) {
      grupo = { modalidade: item.modalidade, nome: item.modalidade_display, itens: [] }
      grupos.push(grupo)
    }
    grupo.itens.push(item)
  }
  return grupos
}

/**
 * Passo 2 do cadastro/edição do edital: o Coordenador de Área escolhe, do catálogo
 * institucional fixo (modalidade + CH), o que estará disponível no edital e o valor
 * mensal de cada combinação.
 */
export default function ValoresBolsaModal({ edital, onSalvo, onFechar }) {
  const [itens, setItens] = useState([])
  const [inicial, setInicial] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const somenteLeitura = !['RASCUNHO', 'EM_VIGOR'].includes(edital.status)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const res = await editaisFetch(`/${edital.id}/valores-bolsa/`)
        const dados = await res.json().catch(() => null)
        if (!res.ok || !Array.isArray(dados)) {
          throw new Error(dados?.detail || 'Não foi possível carregar o catálogo de bolsas.')
        }
        if (ativo) {
          const formulario = dados.map(paraFormulario)
          setItens(formulario)
          setInicial(assinatura(formulario))
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
  }, [edital.id])

  function atualizar(id, campos) {
    setItens((atuais) =>
      atuais.map((item) => (item.tipo_bolsa_modalidade === id ? { ...item, ...campos } : item))
    )
  }

  function alternar(item, disponivel) {
    atualizar(item.tipo_bolsa_modalidade, {
      disponivel,
      // ao ligar, sugere o valor máximo institucional
      valor: disponivel && item.valor === '' ? item.valor_maximo : item.valor,
    })
  }

  const selecionados = itens.filter((item) => item.disponivel)
  const temErro = selecionados.some((item) => erroDoValor(item))
  const alterado = !carregando && assinatura(itens) !== inicial

  async function salvar() {
    if (!alterado) {
      onSalvo()
      return
    }
    setSalvando(true)
    setErro('')
    try {
      const res = await editaisFetch(`/${edital.id}/valores-bolsa/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valores: selecionados.map((item) => ({
            tipo_bolsa_modalidade: item.tipo_bolsa_modalidade,
            valor_mensal: item.valor,
          })),
        }),
      })
      const dados = await res.json().catch(() => null)
      if (!res.ok) throw new Error(mensagemDeErro(dados, 'Não foi possível salvar os valores.'))
      onSalvo()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const bloqueado = somenteLeitura || salvando
  // Fechar sem concluir: avisa a página se o edital ficou sem nenhuma modalidade salva.
  const fechar = () => onFechar(inicial === '')

  return (
    <Modal title="Modalidades e valores de bolsa (2 de 2)" onClose={fechar} width={640}>
      <p className="valores-bolsa__intro">
        {edital.nome} ({edital.ano_codigo}). Ative as combinações do catálogo institucional que este
        edital oferece e defina o valor mensal de cada uma, respeitando o valor máximo.
      </p>

      {erro && <Alert tone="error">{erro}</Alert>}
      {somenteLeitura && (
        <Alert tone="warning">Editais encerrados ou arquivados não podem ser alterados.</Alert>
      )}

      {carregando ? (
        <Carregando texto="Carregando catálogo..." />
      ) : (
        <>
          <div className="valores-bolsa__resumo">
            <span>
              <strong>{selecionados.length}</strong> de {itens.length} combinações disponíveis neste
              edital
            </span>
          </div>

          <div className="valores-bolsa__grupos">
            {agruparPorModalidade(itens).map((grupo) => {
              const ativos = grupo.itens.filter((item) => item.disponivel).length
              return (
                <section
                  key={grupo.modalidade}
                  className="valores-bolsa__grupo"
                  aria-label={grupo.nome}
                >
                  <header className="valores-bolsa__grupo-cabecalho">
                    <span className="valores-bolsa__sigla">{grupo.modalidade}</span>
                    <span className="valores-bolsa__nome">{grupo.nome}</span>
                    <span className="valores-bolsa__contador">
                      {ativos} de {grupo.itens.length} ativa{grupo.itens.length > 1 ? 's' : ''}
                    </span>
                  </header>

                  {grupo.itens.map((item) => {
                    const mensagem = erroDoValor(item)
                    const rotulo = `${item.modalidade} ${item.carga_horaria_semanal}h`
                    return (
                      <div key={item.tipo_bolsa_modalidade} className="valores-bolsa__linha">
                        <label className="valores-bolsa__chave">
                          <input
                            type="checkbox"
                            role="switch"
                            aria-label={`Oferecer ${rotulo}`}
                            checked={item.disponivel}
                            disabled={bloqueado}
                            onChange={(e) => alternar(item, e.target.checked)}
                          />
                          <span className="valores-bolsa__chave-trilho" />
                        </label>

                        <div className="valores-bolsa__ch">
                          <span className="valores-bolsa__ch-titulo">
                            {item.carga_horaria_semanal}h semanais
                          </span>
                          <span className="valores-bolsa__ch-maximo">
                            Máximo institucional: {formatarMoeda(item.valor_maximo)}
                          </span>
                        </div>

                        <div className="valores-bolsa__valor">
                          <div
                            className={[
                              'valores-bolsa__moeda',
                              mensagem && 'valores-bolsa__moeda--erro',
                              !item.disponivel && 'valores-bolsa__moeda--desativada',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <span className="valores-bolsa__prefixo">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={item.valor_maximo}
                              aria-label={`Valor mensal ${rotulo}`}
                              placeholder={item.disponivel ? '0,00' : 'Não oferecida'}
                              value={item.disponivel ? item.valor : ''}
                              disabled={!item.disponivel || bloqueado}
                              onChange={(e) =>
                                atualizar(item.tipo_bolsa_modalidade, { valor: e.target.value })
                              }
                            />
                          </div>
                          {mensagem && <span className="valores-bolsa__erro">{mensagem}</span>}
                          {item.disponivel &&
                            !bloqueado &&
                            Number(item.valor) !== Number(item.valor_maximo) && (
                              <button
                                type="button"
                                className="valores-bolsa__usar-maximo"
                                onClick={() =>
                                  atualizar(item.tipo_bolsa_modalidade, {
                                    valor: item.valor_maximo,
                                  })
                                }
                              >
                                Usar o máximo
                              </button>
                            )}
                        </div>
                      </div>
                    )
                  })}
                </section>
              )
            })}
          </div>
        </>
      )}

      <FormActions>
        <Button variant="outline" onClick={fechar} disabled={salvando}>
          {somenteLeitura ? 'Fechar' : 'Definir depois'}
        </Button>
        {!somenteLeitura && (
          <Button
            variant="accent"
            onClick={salvar}
            disabled={carregando || temErro}
            loading={salvando}
          >
            Concluir
          </Button>
        )}
      </FormActions>
    </Modal>
  )
}
