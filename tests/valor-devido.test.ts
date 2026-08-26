import { describe, it, expect } from 'vitest'
import {
  calcularValorDevido,
  somarValorDevido,
} from '@/lib/calculo/valor-devido'

describe('calcularValorDevido — regra de domínio nº 1: nunca somar acordo com condenação', () => {
  it('usa o acordo quando ambos existem, mesmo se o acordo for MENOR', () => {
    const r = calcularValorDevido({ valorAcordo: 30_000, valorCondenacao: 100_000 })
    expect(r).toEqual({ valor: 30_000, origem: 'acordo' })
  })

  it('usa o acordo quando ambos existem, mesmo se o acordo for MAIOR (custas)', () => {
    const r = calcularValorDevido({ valorAcordo: 120_000, valorCondenacao: 100_000 })
    expect(r).toEqual({ valor: 120_000, origem: 'acordo' })
  })

  it('NUNCA retorna a soma dos dois', () => {
    const r = calcularValorDevido({ valorAcordo: 30_000, valorCondenacao: 100_000 })
    expect(r.valor).not.toBe(130_000)
  })

  it('usa a condenação quando não há acordo', () => {
    const r = calcularValorDevido({ valorAcordo: null, valorCondenacao: 100_000 })
    expect(r).toEqual({ valor: 100_000, origem: 'condenacao' })
  })

  it('usa o acordo quando não há condenação', () => {
    const r = calcularValorDevido({ valorAcordo: 45_000, valorCondenacao: null })
    expect(r).toEqual({ valor: 45_000, origem: 'acordo' })
  })

  it('retorna 0 com origem "nenhum" quando não há nenhum dos dois', () => {
    const r = calcularValorDevido({ valorAcordo: null, valorCondenacao: null })
    expect(r).toEqual({ valor: 0, origem: 'nenhum' })
  })

  it('trata acordo de valor 0 como valor legítimo, não como ausência', () => {
    // Acordo homologado sem desembolso. Se 0 fosse tratado como falsy, cairia
    // na condenação e inflaria o passivo em 100 mil.
    const r = calcularValorDevido({ valorAcordo: 0, valorCondenacao: 100_000 })
    expect(r).toEqual({ valor: 0, origem: 'acordo' })
  })

  it('ignora NaN, que pode vir de célula com texto ("N/A")', () => {
    const r = calcularValorDevido({ valorAcordo: Number.NaN, valorCondenacao: 80_000 })
    expect(r).toEqual({ valor: 80_000, origem: 'condenacao' })
  })
})

describe('somarValorDevido', () => {
  it('aplica a precedência processo a processo antes de somar', () => {
    const total = somarValorDevido([
      { valorAcordo: 30_000, valorCondenacao: 100_000 }, // conta 30.000
      { valorAcordo: null, valorCondenacao: 50_000 }, // conta 50.000
      { valorAcordo: 20_000, valorCondenacao: null }, // conta 20.000
      { valorAcordo: null, valorCondenacao: null }, // conta 0
    ])
    expect(total).toBe(100_000)
  })

  it('o total é menor que a soma ingênua de todos os campos', () => {
    const processos = [
      { valorAcordo: 30_000, valorCondenacao: 100_000 },
      { valorAcordo: 25_000, valorCondenacao: 90_000 },
    ]
    const somaIngenua = 30_000 + 100_000 + 25_000 + 90_000 // 245.000
    expect(somarValorDevido(processos)).toBe(55_000)
    expect(somarValorDevido(processos)).toBeLessThan(somaIngenua)
  })

  it('retorna 0 para lista vazia', () => {
    expect(somarValorDevido([])).toBe(0)
  })
})
