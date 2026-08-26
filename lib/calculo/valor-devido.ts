/**
 * Regra de domínio nº 1 do CLAUDE.md — a mais cara de errar.
 *
 * `Valor do Acordo` e `Valor total da condenação` podem vir preenchidos ao mesmo
 * tempo (32 casos em ~870 na carga real de julho/2026). O acordo SUBSTITUI a
 * condenação — às vezes para menos, às vezes para mais, incluindo custas.
 *
 * Somar os dois infla o resultado em até 2x em Taxa de Êxito, Previsão de
 * Desembolso e Contas a Pagar. Esta função existe para que exista UM só lugar
 * onde essa escolha é feita.
 */

/** Valores financeiros de um processo, como chegam da planilha já normalizados. */
export interface ValoresProcesso {
  /** `Valor do Acordo`. null quando não houve acordo. */
  valorAcordo: number | null
  /** `Valor total da condenação`. null quando não houve condenação. */
  valorCondenacao: number | null
}

/** Qual campo originou o valor devido — necessário para auditoria do cálculo. */
export type OrigemValorDevido = 'acordo' | 'condenacao' | 'nenhum'

export interface ValorDevido {
  valor: number
  origem: OrigemValorDevido
}

/**
 * Retorna o valor efetivamente devido no processo.
 *
 * Precedência: acordo vence condenação. Nunca soma.
 *
 * Um valor 0 é um valor legítimo (acordo homologado sem desembolso) e é
 * diferente de ausência — por isso a checagem é contra null/undefined/NaN, e
 * não contra falsy.
 */
export function calcularValorDevido(valores: ValoresProcesso): ValorDevido {
  const acordo = normalizar(valores.valorAcordo)
  const condenacao = normalizar(valores.valorCondenacao)

  if (acordo !== null) return { valor: acordo, origem: 'acordo' }
  if (condenacao !== null) return { valor: condenacao, origem: 'condenacao' }
  return { valor: 0, origem: 'nenhum' }
}

/** Soma o valor devido de vários processos, aplicando a precedência caso a caso. */
export function somarValorDevido(processos: ValoresProcesso[]): number {
  return processos.reduce((total, p) => total + calcularValorDevido(p).valor, 0)
}

function normalizar(valor: number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor !== 'number' || Number.isNaN(valor)) return null
  return valor
}
