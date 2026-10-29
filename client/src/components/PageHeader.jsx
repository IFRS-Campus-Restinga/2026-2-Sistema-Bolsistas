/**
 * Cabeçalho de página com título, badge opcional e ação.
 *
 * Uso: <PageHeader title="Editais" action={<Button>Novo</Button>} />
 */
export function PageHeader({ title, action, badge }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{title}</h1>
        {badge}
      </div>
      {action}
    </div>
  )
}
