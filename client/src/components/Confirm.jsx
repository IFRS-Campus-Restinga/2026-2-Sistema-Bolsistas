import { useState } from 'react'
import { ConfirmContext } from './useConfirm'
import { Modal } from './Modal'
import { Button } from './Button'
import { FormActions } from './FormField'

/**
 * Provider para diálogo de confirmação.
 * Envolva a aplicação com <ConfirmProvider> e use o hook useConfirm().
 */
export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null)

  const confirm = (o) => setOpts(o)

  const toneVariant = {
    danger: 'danger',
    accent: 'accent',
    primary: 'primary',
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <Modal title={opts.title} onClose={() => setOpts(null)} width={400}>
          <p className="confirm__message">{opts.message}</p>
          <FormActions>
            <Button variant="outline" onClick={() => setOpts(null)}>
              Cancelar
            </Button>
            <Button
              variant={toneVariant[opts.tone ?? 'primary']}
              onClick={() => {
                opts.onConfirm()
                setOpts(null)
              }}
            >
              {opts.confirmLabel}
            </Button>
          </FormActions>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}
