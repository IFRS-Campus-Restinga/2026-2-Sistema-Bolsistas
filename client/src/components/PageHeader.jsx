import './PageHeader.css'

/**
 * Cabeçalho de página com título, badge opcional e ação.
 *
 * Uso: <PageHeader title="Editais" action={<Button>Novo</Button>} />
 */
export function PageHeader({ title, action, badge }) {
  return (
    <div className="page-header">
      <div className="page-header__left">
        <h1 className="page-header__title">{title}</h1>
        {badge}
      </div>
      {action}
    </div>
  )
}
