/**
 * Projeção de desembolso — 6, 12 e 24 meses.
 *
 * Alimentada pelas parcelas de acordo, que são a única fonte com data e valor
 * por mês. A janela cresce a cada envio mensal: começou em 6 meses e vai até
 * 24, então a projeção NUNCA assume um número fixo de meses — ela soma o que
 * existe dentro do horizonte pedido e informa até onde os dados alcançam.
 *
 * O que a projeção mostra além do total: se o horizonte pedido é maior do que
 * a cobertura real das parcelas, isso é dito explicitamente. Um total de 24
 * meses calculado sobre 8 meses de dados parece completo e não é.
 */

export interface ParcelaParaProjetar {
  /** "2026-07" — mês a que a parcela se refere. */
  mesReferencia: string
  valor: number
}

export interface MesProjetado {
  mesReferencia: string
  valor: number
  casos: number
}

export interface Horizonte {
  meses: 6 | 12 | 24
  total: number
  /** Quantos dos meses do horizonte têm alguma parcela. */
  mesesComDados: number
  /**
   * true quando o horizonte pedido vai além do último mês com dados.
   * O total continua correto, mas está incompleto por falta de informação.
   */
  incompleto: boolean
}

export interface ResultadoProjecao {
  /** Mês a partir do qual a projeção conta, inclusive. */
  mesInicial: string
  /** Série mês a mês, só com os meses que têm parcela. */
  serie: MesProjetado[]
  horizontes: Record<6 | 12 | 24, Horizonte>
  totalGeral: number
  /** Último mês com parcela conhecida. null quando não há nenhuma. */
  ultimoMesComDados: string | null
}

/** Soma N meses a "AAAA-MM", devolvendo "AAAA-MM". */
export function somarMeses(mes: string, n: number): string {
  const [ano, m] = mes.split('-').map(Number)
  const total = ano * 12 + (m - 1) + n
  const novoAno = Math.floor(total / 12)
  const novoMes = (total % 12) + 1
  return `${String(novoAno).padStart(4, '0')}-${String(novoMes).padStart(2, '0')}`
}

/** Diferença em meses entre dois "AAAA-MM". */
export function diferencaMeses(de: string, ate: string): number {
  const [a1, m1] = de.split('-').map(Number)
  const [a2, m2] = ate.split('-').map(Number)
  return (a2 * 12 + m2) - (a1 * 12 + m1)
}

const HORIZONTES: (6 | 12 | 24)[] = [6, 12, 24]

/**
 * @param parcelas  Todas as parcelas conhecidas, de todos os processos.
 * @param mesInicial Mês de referência da importação. A projeção conta a partir
 *                   dele, inclusive — parcelas de meses passados são histórico,
 *                   não previsão, e não entram.
 */
export function calcularProjecao(
  parcelas: ParcelaParaProjetar[],
  mesInicial: string
): ResultadoProjecao {
  const porMes = new Map<string, { valor: number; casos: number }>()

  for (const p of parcelas) {
    // Parcela anterior ao mês de referência já foi paga: é histórico.
    if (diferencaMeses(mesInicial, p.mesReferencia) < 0) continue
    const atual = porMes.get(p.mesReferencia) ?? { valor: 0, casos: 0 }
    atual.valor += p.valor
    atual.casos++
    porMes.set(p.mesReferencia, atual)
  }

  const serie: MesProjetado[] = [...porMes.entries()]
    .map(([mesReferencia, v]) => ({ mesReferencia, valor: v.valor, casos: v.casos }))
    .sort((a, b) => a.mesReferencia.localeCompare(b.mesReferencia))

  const ultimoMesComDados = serie.length ? serie[serie.length - 1].mesReferencia : null

  const horizontes = {} as Record<6 | 12 | 24, Horizonte>
  for (const meses of HORIZONTES) {
    // Horizonte de 6 meses = mesInicial + os 5 seguintes.
    const limite = somarMeses(mesInicial, meses - 1)
    const dentro = serie.filter(m => m.mesReferencia.localeCompare(limite) <= 0)

    horizontes[meses] = {
      meses,
      total: dentro.reduce((s, m) => s + m.valor, 0),
      mesesComDados: dentro.length,
      incompleto:
        ultimoMesComDados === null ||
        diferencaMeses(mesInicial, ultimoMesComDados) < meses - 1,
    }
  }

  return {
    mesInicial,
    serie,
    horizontes,
    totalGeral: serie.reduce((s, m) => s + m.valor, 0),
    ultimoMesComDados,
  }
}

/**
 * Classificação por horizonte curto, para o upload de desembolsos planejados
 * (§3.5 da especificação): até 45 dias, até 90 dias, total acumulado.
 */
export interface DesembolsoPlanejado {
  data: Date
  valor: number
}

export interface ResultadoHorizonteCurto {
  ate45Dias: number
  ate90Dias: number
  totalAcumulado: number
}

export function classificarPorPrazo(
  desembolsos: DesembolsoPlanejado[],
  referencia: Date
): ResultadoHorizonteCurto {
  const dia = 24 * 60 * 60 * 1000
  const limite45 = referencia.getTime() + 45 * dia
  const limite90 = referencia.getTime() + 90 * dia

  let ate45Dias = 0
  let ate90Dias = 0
  let totalAcumulado = 0

  for (const d of desembolsos) {
    const t = d.data.getTime()
    if (t < referencia.getTime()) continue // já passou
    totalAcumulado += d.valor
    // As faixas são cumulativas: o que cabe em 45 dias também cabe em 90.
    if (t <= limite45) ate45Dias += d.valor
    if (t <= limite90) ate90Dias += d.valor
  }

  return { ate45Dias, ate90Dias, totalAcumulado }
}
