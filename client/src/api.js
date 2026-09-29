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

export async function apiFetch(path, options = {}, base = API_BASE) {
  const doFetch = () => fetch(`${base}${path}`, { ...options, credentials: 'include' })

  let res = await doFetch()

  if (res.status === 401) {
    const renovou = await refreshHubSession()
    if (!renovou) throw new SessaoExpiradaError()
    res = await doFetch()
  }

  return res
}

function fetchWithRefresh(base, path = '/', options = {}) {
  return apiFetch(path, options, base)
}

function adminFetch(path, options) {
  return apiFetch(path, options, ADMIN_BASE)
}

export function editaisFetch(path = '/', options = {}) {
  return apiFetch(path, options, `${DJANGO_HOST}/api/editais`)
}

export function inscricoesFetch(path = '/', options = {}) {
  return fetchWithRefresh(`${DJANGO_HOST}/api/inscricoes`, path, options)
}

export function bolsasFetch(path = '/', options = {}) {
  return apiFetch(path, options, `${DJANGO_HOST}/api/bolsas`)
}

export function projetosFetch(path = '/', options = {}) {
  return apiFetch(path, options, `${DJANGO_HOST}/api/projetos`)
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

// ── Auditoria ─────────────────────────────────────────────────────────────

function auditoriaFetch(path = '/', options = {}) {
  return fetchWithRefresh(`${DJANGO_HOST}/api/auditoria`, path, options)
}

export async function getLogsAuditoria({
  pagina = 1,
  usuario,
  ator,
  dataInicio,
  dataFim,
  modelo,
  acao,
} = {}) {
  const params = new URLSearchParams()
  params.set('page', pagina)
  if (usuario) params.set('usuario', usuario)
  else if (ator) params.set('usuario', ator)
  if (dataInicio) params.set('data_inicio', dataInicio)
  if (dataFim) params.set('data_fim', dataFim)
  if (modelo) params.set('modelo', modelo)
  if (acao) params.set('acao', acao)
  return auditoriaFetch(`/logs/?${params}`)
}

export async function getHistoricoCronograma(editalId) {
  return auditoriaFetch(`/editais/${editalId}/cronograma/`)
}

// ── Editais — ações extras ────────────────────────────────────────────────

export async function arquivarEdital(id) {
  return editaisFetch(`/${id}/arquivar/`, { method: 'POST' })
}

export async function getCronogramaConsolidado() {
  return editaisFetch('/cronograma-consolidado/')
}

// ── Frequência ────────────────────────────────────────────────────────────

export async function getFrequencias({ vinculoId, mes } = {}) {
  const params = new URLSearchParams()
  if (vinculoId) params.set('vinculo', vinculoId)
  if (mes) params.set('mes', mes)
  const query = params.toString() ? `?${params}` : ''
  return bolsasFetch(`/frequencias/${query}`)
}

export async function lancarFrequencia(vinculoId, mesReferencia) {
  return bolsasFetch(`/vinculos/${vinculoId}/frequencias/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mes_referencia: mesReferencia }),
  })
}
