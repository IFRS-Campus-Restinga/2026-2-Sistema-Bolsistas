import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { AuthContext } from './useAuth'

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
    // Limpa a URL longa do HUB imediatamente
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname)
    }

    apiFetch('/whoami/')
      .then(async (res) => {
        if (!res.ok) {
          const corpo = await res.json().catch(() => null)
          throw new Error(corpo?.detail || '')
        }
        setMe(await res.json())
      })
      .catch(() => setErro(''))
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
