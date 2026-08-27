/**
 * Top de processos do Relatório Executivo.
 *
 * DUAS listas independentes, não uma. A decisão foi fechada com a coordenadora
 * em 11/08/2026: misturar tudo em um Top 20 único tumultuava o relatório —
 * Trabalhista e IDPJ juntos passam de 30 processos e empurravam para fora os
 * casos grandes não-trabalhistas.
 *
 *   1. Top 20 por VALOR — os 20 maiores acima de R$ 100 mil, com risco
 *      Provável ou Possível, ordenados só pelo valor.
 *   2. Trabalhista + IDPJ COMPLETO — todos, sem limite, porque o motivo de
 *      acompanhá-los é a natureza jurídica e não o valor.
 *
 * Um processo pode aparecer nas duas. Ele não é excluído do Top 20 por ser
 * Trabalhista; apenas não é mais forçado a entrar nele independente do valor.
 */

import { chaveComparacao } from '../ingestao/normalizar.ts'
import { calcularValorDevido } from './valor-devido.ts'
import type { Risco } from './cenarios.ts'

export interface ProcessoParaRanquear {
  id: string
  numeroProcesso: string | null
  carteira: string | null
  /** REGRA 7: o filtro de Trabalhista usa ESTE campo, não `tipoAcao`. */
  area: string | null
  tipoAcao: string | null
  risco: Risco | null
  encerrado: boolean
  valorCausa: number | null
  valorAcordo: number | null
  valorCondenacao: number | null
  valorProvisionado: number | null
}

export interface ProcessoRanqueado extends ProcessoParaRanquear {
  /** Valor usado no ranqueamento, e de onde ele veio. */
  valorRanqueamento: number
  origemValor: 'acordo' | 'condenacao' | 'provisionado' | 'causa' | 'nenhum'
  ehTrabalhista: boolean
  ehIdpj: boolean
}

export const LIMITE_TOP = 20
export const VALOR_MINIMO_TOP = 100_000

/**
 * REGRA 7 — Trabalhista se identifica pelo campo `Area`.
 *
 * Foram encontrados casos com `Area = Trabalhista` cujo `Tipo de Ação` é
 * "Mandado de Segurança" ou "Administrativo" — nenhum contém a palavra
 * "Trabalhista". Um filtro por `tipoAcao` perderia exatamente esses.
 */
export function ehTrabalhista(area: string | null): boolean {
  return area !== null && chaveComparacao(area).includes('trabalhista')
}

/**
 * IDPJ vem do `Tipo de Ação`, que tem "Incidente de Desconsideração da
 * Personalidade Jurídica" como um de seus valores.
 */
export function ehIdpj(tipoAcao: string | null): boolean {
  if (tipoAcao === null) return false
  const k = chaveComparacao(tipoAcao)
  return k.includes('desconsideracao da personalidade juridica') || /\bidpj\b/.test(k)
}

/**
 * Valor que representa o processo no ranking.
 *
 * REGRA 1: acordo vence condenação, e os dois NUNCA são somados.
 *
 * ATENÇÃO ao zero. Na planilha real, 743 dos 799 processos ativos têm
 * `Valor do Acordo = 0` — não vazio, ZERO. Para `calcularValorDevido` isso é
 * um valor legítimo e correto: não há nada a pagar. Para o RANKING, porém,
 * significa "ainda não há valor decidido", e o processo precisa cair para o
 * valor provisionado — senão 743 processos valeriam zero no Top e a lista
 * ficaria com 5 itens em vez de dezenas.
 *
 * São perguntas diferentes: "quanto se deve" versus "qual o tamanho deste
 * caso". Por isso o critério aqui é `> 0`, e não "existe".
 */
export function valorParaRanqueamento(
  p: ProcessoParaRanquear
): { valor: number; origem: ProcessoRanqueado['origemValor'] } {
  const positivo = (v: number | null) => v !== null && v > 0

  if (positivo(p.valorAcordo) || positivo(p.valorCondenacao)) {
    const devido = calcularValorDevido({
      // Zero não conta como "existe" nesta decisão — ver o comentário acima.
      valorAcordo: positivo(p.valorAcordo) ? p.valorAcordo : null,
      valorCondenacao: positivo(p.valorCondenacao) ? p.valorCondenacao : null,
    })
    return { valor: devido.valor, origem: devido.origem as 'acordo' | 'condenacao' }
  }

  if (positivo(p.valorProvisionado)) {
    return { valor: p.valorProvisionado!, origem: 'provisionado' }
  }
  if (positivo(p.valorCausa)) return { valor: p.valorCausa!, origem: 'causa' }
  return { valor: 0, origem: 'nenhum' }
}

function ranquear(p: ProcessoParaRanquear): ProcessoRanqueado {
  const { valor, origem } = valorParaRanqueamento(p)
  return {
    ...p,
    valorRanqueamento: valor,
    origemValor: origem,
    ehTrabalhista: ehTrabalhista(p.area),
    ehIdpj: ehIdpj(p.tipoAcao),
  }
}

export interface ResultadoTop {
  /** Os 20 maiores por valor, acima do mínimo e com risco relevante. */
  topPorValor: ProcessoRanqueado[]
  /** Todos os Trabalhista e IDPJ, sem limite. */
  trabalhistaEIdpj: ProcessoRanqueado[]
  /** Quantos processos passaram no filtro do Top antes do corte em 20. */
  elegiveisAoTop: number
  criterios: {
    valorMinimo: number
    limite: number
    riscosAceitos: Risco[]
  }
}

const RISCOS_TOP: Risco[] = ['PROVAVEL', 'POSSIVEL']

export function calcularTop(processos: ProcessoParaRanquear[]): ResultadoTop {
  const ranqueados = processos.map(ranquear)

  const elegiveis = ranqueados.filter(
    p =>
      !p.encerrado &&
      p.risco !== null &&
      RISCOS_TOP.includes(p.risco) &&
      p.valorRanqueamento > VALOR_MINIMO_TOP
  )

  const topPorValor = [...elegiveis]
    .sort(
      (a, b) =>
        b.valorRanqueamento - a.valorRanqueamento ||
        // Desempate estável, para o relatório não mudar de ordem entre execuções.
        (a.numeroProcesso ?? '').localeCompare(b.numeroProcesso ?? '') ||
        a.id.localeCompare(b.id)
    )
    .slice(0, LIMITE_TOP)

  const trabalhistaEIdpj = ranqueados
    .filter(p => !p.encerrado && (p.ehTrabalhista || p.ehIdpj))
    .sort(
      (a, b) =>
        b.valorRanqueamento - a.valorRanqueamento ||
        (a.numeroProcesso ?? '').localeCompare(b.numeroProcesso ?? '') ||
        a.id.localeCompare(b.id)
    )

  return {
    topPorValor,
    trabalhistaEIdpj,
    elegiveisAoTop: elegiveis.length,
    criterios: {
      valorMinimo: VALOR_MINIMO_TOP,
      limite: LIMITE_TOP,
      riscosAceitos: RISCOS_TOP,
    },
  }
}
