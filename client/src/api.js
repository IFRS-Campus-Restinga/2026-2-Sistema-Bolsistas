const DJANGO_HOST = import.meta.env.VITE_DJANGO_HOST
const HUB_HOST = import.meta.env.VITE_HUB_HOST
const HUB_FRONTEND_HOST = import.meta.env.VITE_HUB_FRONTEND_HOST

export const API_BASE = `${DJANGO_HOST}/api/hub`
export const ADMIN_BASE = `${DJANGO_HOST}/api/admin`
export const HUB_BASE = HUB_HOST
export const HUB_FRONTEND = HUB_FRONTEND_HOST

export function hubHomeUrlPara(role) {
  return role === 'ADMINISTRADOR'
    ? `${HUB_FRONTEND}/session/admin/home/`
    : `${HUB_FRONTEND}/session/user/home`
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

async function fetchWithRefresh(base, path, options = {}) {
  const doFetch = () => fetch(`${base}${path}`, { ...options, credentials: 'include' })

  let res = await doFetch()

  if (res.status === 401) {
    const renovou = await refreshHubSession()
    if (!renovou) throw new SessaoExpiradaError()
    res = await doFetch()
  }

  return res
}

export async function apiFetch(path, options = {}) {
  return fetchWithRefresh(API_BASE, path, options)
}

async function adminFetch(path, options = {}) {
  return fetchWithRefresh(ADMIN_BASE, path, options)
}

export function editaisFetch(path = '/', options = {}) {
  return fetchWithRefresh(`${DJANGO_HOST}/api/editais`, path, options)
}

export function bolsasFetch(path = '/', options = {}) {
  return fetchWithRefresh(`${DJANGO_HOST}/api/bolsas`, path, options)
}

export function projetosFetch(path = '/', options = {}) {
  return fetchWithRefresh(`${DJANGO_HOST}/api/projetos`, path, options)
}

export { SessaoExpiradaError }

export async function getUsuarios() {
  return adminFetch('/usuarios/')
}

export async function patchTipoArea(usuarioId, tipoArea) {
  return adminFetch(`/usuarios/${usuarioId}/tipo-area/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo_area: tipoArea }),
  })
}

export async function patchStatusUsuario(usuarioId, isActive) {
  return adminFetch(`/usuarios/${usuarioId}/status/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: isActive }),
  })
}

export async function getEmailsCoordenadores() {
  return adminFetch('/emails-coordenadores/')
}

export async function postEmailCoordenador(email, tipoArea) {
  return adminFetch('/emails-coordenadores/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, tipo_area: tipoArea }),
  })
}

export async function patchEmailCoordenador(id, email, tipoArea) {
  return adminFetch(`/emails-coordenadores/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, tipo_area: tipoArea }),
  })
}

export async function deleteEmailCoordenador(id) {
  return adminFetch(`/emails-coordenadores/${id}/`, { method: 'DELETE' })
}
