import type { Indicador } from '@/lib/calculo/kpis'

/**
 * Apresentação de número.
 *
 * O motor de cálculo devolve `null` + `indisponivel` quando não há base
 * suficiente, deliberadamente, para nunca confundir "zero" com "não sei".
 * Esta camada preserva essa distinção: indicador sem valor mostra o motivo,
 * não um traço mudo e nunca um zero.
 */

// Formatação vive em lib/formato.ts, compartilhada com tela, script e teste.
// Reexportada aqui por conveniência de quem já importa deste módulo.
import { inteiro } from '@/lib/formato'
export { brl, brlExato, inteiro } from '@/lib/formato'

/** Cartão de KPI. `base` é sempre exibida — número sem lastro engana. */
export function CartaoIndicador({
  rotulo,
  indicador,
  formatar = inteiro,
  sufixo,
  descricaoBase,
}: {
  rotulo: string
  indicador: Indicador
  formatar?: (n: number) => string
  sufixo?: string
  descricaoBase?: (base: number) => string
}) {
  const disponivel = indicador.valor !== null

  return (
    <div className="rounded-ggp border border-borda bg-superficie p-4 shadow-cartao">
      <div className="text-sm text-texto-suave">{rotulo}</div>
      {disponivel ? (
        <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
          {formatar(indicador.valor as number)}
          {sufixo && <span className="ml-0.5 text-lg font-medium">{sufixo}</span>}
        </div>
      ) : (
        <div className="mt-1 text-sm font-medium text-atencao-texto">
          {indicador.indisponivel ?? 'Sem base suficiente'}
        </div>
      )}
      <div className="mt-1 text-xs text-texto-suave">
        {descricaoBase
          ? descricaoBase(indicador.base)
          : `base: ${inteiro(indicador.base)}`}
      </div>
    </div>
  )
}

/** Valor simples, já calculado, sem contrato de Indicador. */
export function CartaoValor({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string
  valor: string
  nota?: string
  destaque?: boolean
}) {
  return (
    <div
      className={[
        'rounded-ggp border p-4 shadow-cartao',
        destaque
          ? 'border-primaria bg-primaria-suave'
          : 'border-borda bg-superficie',
      ].join(' ')}
    >
      <div className="text-sm text-texto-suave">{rotulo}</div>
      <div
        className={[
          'mt-1 text-2xl font-semibold tabular-nums tracking-tight',
          destaque ? 'text-primaria-texto' : '',
        ].join(' ')}
      >
        {valor}
      </div>
      {nota && <div className="mt-1 text-xs text-texto-suave">{nota}</div>}
    </div>
  )
}
