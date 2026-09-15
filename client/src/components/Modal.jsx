import { createContext, useContext, useState } from 'react';
import { Button } from './Button';
import { FormActions } from './FormField';
import './Modal.css';

/**
 * Modal genérico com overlay e cabeçalho.
 *
 * Props:
 *   title    — título do modal
 *   onClose  — callback para fechar
 *   width    — largura máxima (default: 440px)
 *   children — conteúdo
 */
export function Modal({ title, onClose, children, width = 440 }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h3 className="modal__title">{title}</h3>
          <button onClick={onClose} className="modal__close">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

/* ── Confirm Dialog ──────────────────────────────────────────── */

const ConfirmContext = createContext(null);

/**
 * Provider para diálogo de confirmação.
 * Envolva a aplicação com <ConfirmProvider> e use o hook useConfirm().
 *
 * const confirm = useConfirm();
 * confirm({
 *   title: "Desativar usuário?",
 *   message: "O acesso será revogado.",
 *   confirmLabel: "Desativar",
 *   tone: "danger",       // "danger" | "accent" | "primary"
 *   onConfirm: () => { ... },
 * });
 */
export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);

  const confirm = (o) => setOpts(o);

  const toneVariant = {
    danger: 'danger',
    accent: 'accent',
    primary: 'primary',
  };

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
                opts.onConfirm();
                setOpts(null);
              }}
            >
              {opts.confirmLabel}
            </Button>
          </FormActions>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de um ConfirmProvider');
  return ctx;
}
