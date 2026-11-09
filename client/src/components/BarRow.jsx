const COR_DA_BARRA = { brand: 'bg-brand', gray: 'bg-gray-800', amber: 'bg-amber-500' }

/** Barra de progresso fina (valor sobre o máximo). */
export function Progress({ value, max, tone = 'brand' }) {
  const percentual = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full ${COR_DA_BARRA[tone]}`}
        style={{ width: `${percentual}%` }}
      />
    </div>
  )
}

/** Linha de gráfico de barras: rótulo, barra proporcional ao máximo e o valor. */
export function BarRow({ label, value, max }) {
  return (
    <div className="grid grid-cols-[130px_1fr_32px] items-center gap-3 text-sm">
      <span className="truncate text-gray-600">{label}</span>
      <Progress value={value} max={max} tone="gray" />
      <span className="text-right font-medium text-gray-900 tabular-nums">{value}</span>
    </div>
  )
}
