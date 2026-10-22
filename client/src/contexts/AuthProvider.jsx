import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { AuthContext } from './useAuth'

const PARAMETROS_DO_SISTEMA = [
  'aba',
  'pagina',
  'inicio',
  'fim',
  'acao',
  'entidade',
  'usuario',
  'descricao',
]

/**
 * Provider de autenticação.
 * Chama /whoami/ uma vez e expõe o usuário via useAuth().
 *
 * Valores expostos:
 *   me          — objeto do usuário ({ id, nome, email, role, ... }) ou null
 *   carregando  — true enquanto verifica a sessão
 *   erro        — mensagem de erro se falhou
 *   initials    — iniciais do nome do usuário
 */
export function AuthProvider({ children }) {
  const [me, setMe] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    // Limpa a URL longa do HUB, preservando só os parâmetros do próprio sistema
    // (aba e filtros), que permitem recarregar e compartilhar uma tela.
    const atuais = new URLSearchParams(window.location.search)
    const mantidos = new URLSearchParams()
    PARAMETROS_DO_SISTEMA.forEach((nome) => {
      if (atuais.has(nome)) mantidos.set(nome, atuais.get(nome))
    })
    if (atuais.toString() !== mantidos.toString()) {
      const consulta = mantidos.toString()
      window.history.replaceState(
        null,
        '',
        consulta ? `${window.location.pathname}?${consulta}` : window.location.pathname
      )
    }

    apiFetch('/whoami/')
      .then(async (res) => {
        if (!res.ok) {
          const corpo = await res.json().catch(() => null)
          throw new Error(corpo?.detail || 'Não autenticado — acesse este sistema a partir do HUB.')
        }
        setMe(await res.json())
      })
      .catch((e) => {
        if (e.message === 'Failed to fetch') {
          setErro('Não foi possível conectar ao servidor. Verifique se o sistema está online.')
        } else if (e.name === 'SessaoExpiradaError') {
          setErro('Sua sessão expirou. Faça login novamente pelo HUB.')
        } else {
          setErro(e.message)
        }
      })
      .finally(() => setCarregando(false))
  }, [])

  const initials = (() => {
    if (!me?.nome) return '?'
    const partes = me.nome.trim().split(' ')
    if (partes.length === 1) return partes[0][0].toUpperCase()
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
  })()

  return (
    <AuthContext.Provider value={{ me, carregando, erro, initials }}>
      {children}
    </AuthContext.Provider>
  )
}
