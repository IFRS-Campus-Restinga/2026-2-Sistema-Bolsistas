import { useEffect, useState } from 'react'
import { editaisFetch } from '../api'
import { Alert, Button, Carregando, FormActions, Modal } from '../components'
import { formatarMoeda } from '../utils/formatarMoeda'
import { mensagemDeErro } from '../utils/mensagemDeErro'

// Botões e campos herdam line-height "normal" do navegador; leading-[normal] mantém a altura.
const TRILHO =
  "h-full w-full rounded-full bg-gray-300 transition-[background] duration-150 ease-[ease] after:absolute after:top-[3px] after:left-[3px] after:size-4 after:rounded-full after:bg-white after:shadow-[0_1px_2px_rgba(0,0,0,0.2)] after:transition-transform after:duration-150 after:ease-[ease] after:content-[''] peer-checked:bg-if-green peer-checked:after:translate-x-4 peer-focus-visible:shadow-[0_0_0_3px_rgba(74,222,128,0.35)] peer-disabled:opacity-50"

function classesMoeda(comErro, disponivel) {
  return [
    'flex items-center overflow-hidden rounded-xl border transition-shadow duration-150 ease-[ease] focus-within:border-green-300 focus-within:shadow-[0_0_0_3px_rgba(74,222,128,0.25)]',
    comErro ? 'border-red-300' : 'border-gray-200',
    disponivel ? 'bg-white' : 'bg-gray-50',
  ].join(' ')
}

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
      <p className="mb-4 text-gray-500">
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
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5 text-sm">
            <span>
              <strong className="text-gray-800">{selecionados.length}</strong> de {itens.length}{' '}
              combinações disponíveis neste edital
            </span>
          </div>

          <div className="mb-4 flex flex-col gap-3">
            {agruparPorModalidade(itens).map((grupo) => {
              const ativos = grupo.itens.filter((item) => item.disponivel).length
              return (
                <section
                  key={grupo.modalidade}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                  aria-label={grupo.nome}
                >
                  <header className="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50 px-4 py-3">
                    <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-bold tracking-[0.02em] text-if-green-dark">
                      {grupo.modalidade}
                    </span>
                    <span className="font-semibold text-gray-800">{grupo.nome}</span>
                    <span className="ml-auto text-xs text-gray-500">
                      {ativos} de {grupo.itens.length} ativa{grupo.itens.length > 1 ? 's' : ''}
                    </span>
                  </header>

                  {grupo.itens.map((item) => {
                    const mensagem = erroDoValor(item)
                    const rotulo = `${item.modalidade} ${item.carga_horaria_semanal}h`
                    return (
                      <div
                        key={item.tipo_bolsa_modalidade}
                        className="grid grid-cols-[auto_1fr_180px] items-center gap-4 px-4 py-3 max-[560px]:grid-cols-[auto_1fr] [&+&]:border-t [&+&]:border-gray-100"
                      >
                        <label className="relative inline-flex h-[22px] w-[38px] cursor-pointer">
                          <input
                            className="peer absolute m-0 size-full cursor-[inherit] opacity-0"
                            type="checkbox"
                            role="switch"
                            aria-label={`Oferecer ${rotulo}`}
                            checked={item.disponivel}
                            disabled={bloqueado}
                            onChange={(e) => alternar(item, e.target.checked)}
                          />
                          <span className={TRILHO} />
                        </label>

                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-800">
                            {item.carga_horaria_semanal}h semanais
                          </span>
                          <span className="text-xs text-gray-500">
                            Máximo institucional: {formatarMoeda(item.valor_maximo)}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 max-[560px]:col-span-full">
                          <div className={classesMoeda(Boolean(mensagem), item.disponivel)}>
                            <span className="pl-3 text-sm text-gray-400">R$</span>
                            <input
                              className="min-w-0 flex-1 border-0 bg-transparent py-[9px] pr-3 pl-1.5 text-right [font-family:inherit] text-base leading-[normal] text-gray-800 outline-none disabled:text-gray-400"
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
                          {mensagem && <span className="text-xs text-if-red">{mensagem}</span>}
                          {item.disponivel &&
                            !bloqueado &&
                            Number(item.valor) !== Number(item.valor_maximo) && (
                              <button
                                type="button"
                                className="cursor-pointer self-end border-0 bg-transparent p-0 text-xs leading-[normal] text-if-green-dark hover:underline"
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
