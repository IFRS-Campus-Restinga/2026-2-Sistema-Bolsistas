import { formatarMoeda } from '../utils/formatarMoeda'
import { MODALIDADE_LABEL } from '../utils/bolsa'
import { StatusPill } from './Badge'
import { Card } from './Card'
import { IconCalendar, IconUsers } from './Icons'
import { Tag } from './Tag'

/**
 * Card de bolsa, usado nas telas que escolhem uma bolsa (seleção, bolsistas, aluno).
 * Recebe a bolsa como vem da API de bolsas.
 *
 * Props:
 *   showProjeto — mostra o título do projeto
 *   selected    — destaca o card escolhido
 *   footer      — rodapé (ex.: "4 inscritos · 2 a analisar")
 *   meta        — conteúdo à direita do valor
 */
export function BolsaCard({ bolsa, selected, onClick, showProjeto, footer, meta }) {
  const vagas = bolsa.quantidade_vagas
  return (
    <Card onClick={onClick} selected={selected} padded={false} className="flex flex-col">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-semibold text-gray-900">{bolsa.modalidade}</span>
              <span className="text-gray-300">·</span>
              <span className="text-[15px] font-semibold text-gray-900">
                {bolsa.carga_horaria_semanal}h
              </span>
            </div>
            <div className="truncate text-xs text-gray-500">
              {MODALIDADE_LABEL[bolsa.modalidade] ?? bolsa.modalidade_display}
            </div>
          </div>
          <StatusPill status={bolsa.status} size="sm" />
        </div>
        {showProjeto && (
          <div className="line-clamp-2 text-sm font-medium text-gray-700">
            {bolsa.projeto_titulo}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Tag>{bolsa.tipo_display}</Tag>
          <Tag icon={<IconUsers />}>
            {vagas} {vagas === 1 ? 'vaga' : 'vagas'}
          </Tag>
          {bolsa.edital_ano_codigo && <Tag icon={<IconCalendar />}>{bolsa.edital_ano_codigo}</Tag>}
        </div>
        <div className="flex items-end justify-between">
          <span className="text-lg font-semibold tracking-tight text-gray-900 tabular-nums">
            {formatarMoeda(bolsa.valor_mensal)}
            <span className="text-xs font-normal text-gray-400"> /mês</span>
          </span>
          {meta}
        </div>
      </div>
      {footer && <div className="mt-auto border-t border-gray-100 px-4 py-2.5">{footer}</div>}
    </Card>
  )
}

/** Grade de cards de bolsa selecionáveis (padrão "escolha a bolsa, veja abaixo"). */
export function BolsaPicker({ bolsas, value, onChange, meta }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {bolsas.map((bolsa) => (
        <BolsaCard
          key={bolsa.id}
          bolsa={bolsa}
          showProjeto
          selected={value === bolsa.id}
          onClick={() => onChange(bolsa.id)}
          footer={meta?.(bolsa)}
        />
      ))}
    </div>
  )
}
