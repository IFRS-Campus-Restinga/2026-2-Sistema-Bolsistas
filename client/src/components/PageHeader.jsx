/**
 * Cabeçalho de página com título, badge e descrição opcionais e ação à direita.
 *
 * Uso: <PageHeader title="Editais" description="..." action={<Button>Novo</Button>} />
 */
export function PageHeader({ title, action, badge, description }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}
