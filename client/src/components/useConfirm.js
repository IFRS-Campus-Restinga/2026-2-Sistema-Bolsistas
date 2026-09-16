import { createContext, useContext } from 'react'

export const ConfirmContext = createContext(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de um ConfirmProvider')
  return ctx
}
