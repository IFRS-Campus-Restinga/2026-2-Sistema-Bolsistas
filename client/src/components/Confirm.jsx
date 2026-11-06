import { useState } from 'react'
import { ConfirmContext } from './useConfirm'
import { Alert } from './Alert'
import { Modal } from './Modal'
import { Button } from './Button'
import { FormActions } from './FormField'

/**
 * Provider para diálogo de confirmação.
 * Envolva a aplicação com <ConfirmProvider> e use o hook useConfirm().
 *
 * Se `onConfirm` for assíncrono, o diálogo fica aberto com o botão em
 * carregamento até a ação terminar; se ela lançar erro, a mensagem aparece
 * dentro do diálogo.
 */
export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null)
  const [executando, setExecutando] = useState(false)
  const [erro, setErro] = useState('')

  const confirm = (o) => {
    setErro('')
    setOpts(o)
  }

  function fechar() {
    if (!executando) setOpts(null)
  }

  async function executar() {
    setExecutando(true)
    setErro('')
    try {
      await opts.onConfirm()
      setOpts(null)
    } catch (e) {
      setErro(e?.message || 'Não foi possível concluir a ação.')
    } finally {
      setExecutando(false)
    }
  }

  const toneVariant = {
    danger: 'danger',
    accent: 'accent',
    primary: 'primary',
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <Modal title={opts.title} onClose={fechar} width={400}>
          <p className="mb-5 text-base text-gray-600">{opts.message}</p>
          {erro && <Alert tone="error">{erro}</Alert>}
          <FormActions>
            <Button
              variant={opts.tone === 'danger' ? 'outline' : 'danger'}
              onClick={fechar}
              disabled={executando}
            >
              Cancelar
            </Button>
            <Button
              variant={toneVariant[opts.tone ?? 'primary']}
              onClick={executar}
              loading={executando}
            >
              {opts.confirmLabel}
            </Button>
          </FormActions>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}
