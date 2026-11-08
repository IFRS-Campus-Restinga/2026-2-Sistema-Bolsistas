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
export { TopHeader, Avatar } from './TopHeader'
export { Layout } from './Layout'

// Button (#178)
export { Button } from './Button'

// Carregamento
export { Spinner } from './Spinner'
export { Carregando } from './Carregando'
export { BarraProgresso } from './BarraProgresso'

// Card & Table (#180)
export { StatCard } from './StatCard'
export { DataTable } from './DataTable'
export { Paginacao } from './Paginacao'
export { Badge, StatusPill } from './Badge'
export { Banner } from './Banner'
export { PageHeader } from './PageHeader'
export { Alert } from './Alert'
export { AcoesCell } from './AcoesCell'
export { LocalEtapa } from './LocalEtapa'

// Design system do protótipo (#456)
export { Card } from './Card'
export { SectionTitle } from './SectionTitle'
export { KeyValue } from './KeyValue'
export { Tabs } from './Tabs'
export { EmptyState } from './EmptyState'
export { Hint } from './Hint'
export { Drawer } from './Drawer'
export { Timeline } from './Timeline'
export { Stepper } from './Stepper'
export { Tag } from './Tag'
export { BolsaCard, BolsaPicker } from './BolsaCard'

// Form / Input (#179)
export { FormField, FormActions, TextInput, TextArea, Select, FileField } from './FormField'
export { Modal } from './Modal'
export { ConfirmProvider } from './Confirm'
export { useConfirm } from './useConfirm'
export { ToastProvider } from './Toast'
export { useToast } from './useToast'

// Rotas (#182)
export { default as ProtectedRoute } from './ProtectedRoute'
