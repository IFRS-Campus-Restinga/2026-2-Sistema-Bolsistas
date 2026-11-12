import { inscricoesFetch } from '../api'

/** Baixa o PDF do comprovante de inscrição gerado pelo backend (US91). */
export async function baixarComprovanteInscricao(inscricaoId, protocolo) {
  const res = await inscricoesFetch(`/${inscricaoId}/comprovante.pdf`)
  if (!res.ok) throw new Error('Não foi possível gerar o PDF do comprovante.')
  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = `comprovante-${protocolo || inscricaoId}.pdf`
  link.click()
  // Libera o blob só depois que o navegador começou o download (Firefox e Safari).
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
