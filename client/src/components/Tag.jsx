/**
 * Etiqueta neutra para metadados (tipo de bolsa, vagas, código do edital...).
 *
 * Uso: <Tag icon={<IconUsers />}>2 vagas</Tag>
 */
export function Tag({ children, icon }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-2xs font-medium text-gray-600 [&_svg]:size-3">
      {icon}
      {children}
    </span>
  )
}
