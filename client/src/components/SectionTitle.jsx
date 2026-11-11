/**
 * Título de uma seção dentro da página, com descrição e ação opcionais.
 *
 * Uso: <SectionTitle title="Bolsas do projeto" action={<Button>Solicitar bolsa</Button>} />
 */
export function SectionTitle({ title, description, action }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}
