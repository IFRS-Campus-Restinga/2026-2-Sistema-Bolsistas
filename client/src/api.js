const DJANGO_HOST = import.meta.env.VITE_DJANGO_HOST
const HUB_HOST = import.meta.env.VITE_HUB_HOST
const HUB_FRONTEND_HOST = import.meta.env.VITE_HUB_FRONTEND_HOST

export const API_BASE = `${DJANGO_HOST}/api/hub`
export const HUB_BASE = HUB_HOST
export const HUB_FRONTEND = HUB_FRONTEND_HOST

export function hubHomeUrlPara(role) {
  return role === 'ALUNO'
    ? `${HUB_FRONTEND}/session/user/home`
    : `${HUB_FRONTEND}/session/admin/home/`
}

class SessaoExpiradaError extends Error {
  constructor() {
    super('Sessão expirada — faça login novamente pelo HUB.')
    this.name = 'SessaoExpiradaError'
  }
}

async function refreshHubSession() {
  const res = await fetch(`${HUB_BASE}/session/token/refresh/`, {
    method: 'GET',
    credentials: 'include',
  })
  return res.ok
}

export async function apiFetch(path, options = {}) {
  const doFetch = () => fetch(`${API_BASE}${path}`, { ...options, credentials: 'include' })

  let res = await doFetch()

  if (res.status === 401) {
    const renovou = await refreshHubSession()
    if (!renovou) throw new SessaoExpiradaError()

    res = await doFetch()
  }

  return res
}

export { SessaoExpiradaError }
