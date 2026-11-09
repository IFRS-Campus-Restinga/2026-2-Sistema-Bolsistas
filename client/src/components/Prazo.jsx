import { IconClock } from './Icons'

/**
 * Quanto falta para um prazo ("Encerra em 5 dias"), com o tom pela urgência. Sem
 * `prefixo`, mostra só "Em 5 dias" / "Hoje".
 * `dias` vem calculado do servidor, para não depender do relógio do navegador.
 */
export function Prazo({ dias, prefixo = 'Encerra' }) {
  const tom = dias <= 3 ? 'text-red-600' : dias <= 7 ? 'text-amber-600' : 'text-gray-500'
  const quando = `${dias} ${dias === 1 ? 'dia' : 'dias'}`
  let texto = dias === 0 ? 'Hoje' : `Em ${quando}`
  if (prefixo) texto = dias === 0 ? `${prefixo} hoje` : `${prefixo} em ${quando}`
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${tom}`}>
      <IconClock size={13} />
      {texto}
    </span>
  )
}
