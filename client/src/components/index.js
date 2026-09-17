/* ══════════════════════════════════════════════════════════════
   Componentes reutilizáveis — Sistema de Bolsistas
   ══════════════════════════════════════════════════════════════

   Uso:
     import { Layout, Button, DataTable, Badge } from '../components';
   ══════════════════════════════════════════════════════════════ */

// Icons
export * from './Icons'

// Logo
export { IFLogo } from './IFLogo'

// Layout (#177)
export { Sidebar } from './Sidebar'
export { TopHeader } from './TopHeader'
export { Layout } from './Layout'

// Button (#178)
export { Button } from './Button'

// Card & Table (#180)
export { StatCard } from './StatCard'
export { DataTable } from './DataTable'
export { Badge } from './Badge'
export { Banner } from './Banner'
export { PageHeader } from './PageHeader'
export { Alert } from './Alert'

// Form / Input (#179)
export { FormField, FormActions, TextInput, TextArea, Select, FileField } from './FormField'
export { Modal } from './Modal'
export { ConfirmProvider } from './Confirm'
export { useConfirm } from './useConfirm'
export { ToastProvider } from './Toast'
export { useToast } from './useToast'

// Rotas (#182)
export { default as ProtectedRoute } from './ProtectedRoute'
