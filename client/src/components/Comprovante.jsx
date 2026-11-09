import { StatusPill } from './Badge'
import { IFLogo } from './IFLogo'
import { IconCheckCircle } from './Icons'
import { formatarData } from '../utils/dataHora'

/**
 * Comprovante (inscrição, e depois recurso) como no protótipo, com os dados que o
 * backend monta para a tela e para o PDF (`comprovante` da API).
 */
export function Comprovante({ dados }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div className="flex items-center justify-between gap-4 bg-gray-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <IFLogo size={30} />
          <div>
            <div className="text-sm font-semibold text-gray-900">{dados.titulo}</div>
            <div className="text-xs text-gray-500">IFRS · Campus Restinga</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xs text-gray-500">Protocolo</div>
          <div className="font-mono text-sm font-semibold tracking-wide text-gray-900">
            {dados.protocolo}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4">
        {dados.linhas.map((linha) => (
          <div key={linha.rotulo} className="min-w-0">
            <dt className="text-xs text-gray-500">{linha.rotulo}</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-900">{linha.valor}</dd>
          </div>
        ))}
        {dados.situacao && (
          <div className="min-w-0">
            <dt className="text-xs text-gray-500">Situação</dt>
            <dd className="mt-0.5">
              <StatusPill status={dados.situacao.status} label={dados.situacao.rotulo} />
            </dd>
          </div>
        )}
      </dl>
      {dados.documentos?.length > 0 && (
        <div className="border-t border-dashed border-gray-200 px-5 py-3">
          <div className="mb-1.5 text-xs text-gray-500">Documentos anexados</div>
          <ul className="m-0 list-none space-y-1 p-0">
            {dados.documentos.map((documento) => (
              <li key={documento} className="flex items-center gap-2 text-sm text-gray-700">
                <IconCheckCircle size={14} className="text-brand" /> {documento}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-2.5 text-2xs text-gray-500">
        <span>{dados.rodape}</span>
        <span>Emitido em {formatarData(dados.emitido_em)}</span>
      </div>
    </div>
  )
}
