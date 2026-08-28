/**
 * Formatação para exibição — pt-BR.
 *
 * Existe porque estas funções estavam copiadas pelas telas, e uma delas
 * (`mesPorExtenso`) era importada de `app/relatorio/Relatorio.tsx` por outras
 * três páginas: um componente de tela virara biblioteca das demais. Formatar
 * data não é responsabilidade do Relatório Executivo.
 *
 * Sem dependência de React ou Prisma, para servir tela, script e teste igual.
 */

const NOMES_MES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

const ABREVIACOES_MES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const

/** Índice 0-11 de um mês "AAAA-MM", ou null se o formato não for esse. */
function indiceDoMes(mes: string): number | null {
  const partes = mes.split('-')
  if (partes.length !== 2) return null
  const n = Number(partes[1])
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n - 1 : null
}

/** "2026-07" -> "julho de 2026". Devolve a entrada quando não reconhece. */
export function mesPorExtenso(mes: string): string {
  const i = indiceDoMes(mes)
  return i === null ? mes : `${NOMES_MES[i]} de ${mes.split('-')[0]}`
}

/** "2026-07" -> "jul/26". Para eixo de gráfico, onde espaço é curto. */
export function mesAbreviado(mes: string): string {
  const i = indiceDoMes(mes)
  return i === null ? mes : `${ABREVIACOES_MES[i]}/${mes.split('-')[0].slice(2)}`
}

/** Moeda sem centavos — o padrão do painel, onde os valores são grandes. */
export function brl(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

/** Moeda com centavos. Para conferência e para valor por processo. */
export function brlExato(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Inteiro com separador de milhar. */
export function inteiro(valor: number): string {
  return valor.toLocaleString('pt-BR')
}

/**
 * Abrevia valor para eixo de gráfico: 1.200.000 -> "1,2 mi".
 *
 * Só para o eixo. O tooltip e a tabela sempre mostram o valor cheio — quem
 * decide provisionamento não deve ler número arredondado.
 */
export function valorAbreviado(valor: number): string {
  const abs = Math.abs(valor)
  if (abs >= 1_000_000) {
    return `${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  }
  if (abs >= 1_000) return `${Math.round(valor / 1_000)} mil`
  return String(valor)
}

/** Data e hora curtas, para carimbo de importação. */
export function dataHora(d: Date): string {
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
