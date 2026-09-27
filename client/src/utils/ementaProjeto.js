import { projetosFetch } from '../api'

export const EXTENSOES_EMENTA = ['pdf', 'doc', 'docx']
export const TAMANHO_MAX_EMENTA_MB = 10

/** Mensagem de erro se o arquivo não puder ser enviado, ou "" se estiver ok. */
export function validarArquivoEmenta(arquivo) {
  const extensao = arquivo.name.split('.').pop().toLowerCase()
  if (!EXTENSOES_EMENTA.includes(extensao)) {
    return 'Formato não permitido. Envie .pdf, .doc ou .docx.'
  }
  if (arquivo.size > TAMANHO_MAX_EMENTA_MB * 1024 * 1024) {
    return `O arquivo deve ter no máximo ${TAMANHO_MAX_EMENTA_MB} MB.`
  }
  return ''
}

export async function enviarEmentaProjeto(projetoId, arquivo) {
  const formData = new FormData()
  formData.append('arquivo', arquivo)
  const res = await projetosFetch(`/${projetoId}/arquivo/`, { method: 'POST', body: formData })
  const corpo = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(corpo?.arquivo?.[0] || corpo?.detail || 'Erro ao enviar o arquivo.')
  }
  return corpo
}

export async function removerEmentaProjeto(projetoId) {
  const res = await projetosFetch(`/${projetoId}/arquivo/`, { method: 'DELETE' })
  if (!res.ok) {
    const corpo = await res.json().catch(() => null)
    throw new Error(corpo?.detail || 'Erro ao remover o arquivo.')
  }
}
