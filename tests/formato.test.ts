import { describe, it, expect } from 'vitest'
import {
  brl,
  brlExato,
  inteiro,
  mesAbreviado,
  mesPorExtenso,
  valorAbreviado,
} from '@/lib/formato'

/** O nbsp que o Intl insere entre "R$" e o número. */
const semNbsp = (s: string) => s.replace(/\s/g, ' ')

describe('mesPorExtenso', () => {
  it('traduz o mês e mantém o ano', () => {
    expect(mesPorExtenso('2026-07')).toBe('julho de 2026')
    expect(mesPorExtenso('2026-01')).toBe('janeiro de 2026')
    expect(mesPorExtenso('2026-12')).toBe('dezembro de 2026')
  })

  it('devolve a entrada quando não reconhece o formato', () => {
    // Melhor exibir o valor cru que um "undefined de 2026" na tela.
    expect(mesPorExtenso('2026')).toBe('2026')
    expect(mesPorExtenso('2026-13')).toBe('2026-13')
    expect(mesPorExtenso('2026-00')).toBe('2026-00')
    expect(mesPorExtenso('')).toBe('')
  })
})

describe('mesAbreviado', () => {
  it('abrevia mês e ano para caber no eixo do gráfico', () => {
    expect(mesAbreviado('2026-07')).toBe('jul/26')
    expect(mesAbreviado('2026-12')).toBe('dez/26')
  })

  it('devolve a entrada quando não reconhece', () => {
    expect(mesAbreviado('xx')).toBe('xx')
  })
})

describe('moeda', () => {
  it('brl não mostra centavos — os valores do painel são grandes', () => {
    expect(semNbsp(brl(24_539_607))).toBe('R$ 24.539.607')
    expect(semNbsp(brl(0))).toBe('R$ 0')
  })

  it('brlExato mostra centavos, para conferência', () => {
    expect(semNbsp(brlExato(1234.56))).toBe('R$ 1.234,56')
  })

  it('zero é formatado como valor, nunca omitido', () => {
    // Zero é uma afirmação sobre o processo: não há nada a pagar.
    expect(semNbsp(brl(0))).toContain('0')
  })
})

describe('inteiro', () => {
  it('usa separador de milhar do pt-BR', () => {
    expect(inteiro(836)).toBe('836')
    expect(inteiro(1_234)).toBe('1.234')
  })
})

describe('valorAbreviado', () => {
  it('abrevia milhões e milhares', () => {
    expect(valorAbreviado(1_200_000)).toBe('1,2 mi')
    expect(valorAbreviado(24_539_607)).toBe('24,5 mi')
    expect(valorAbreviado(45_000)).toBe('45 mil')
  })

  it('mantém valores pequenos como estão', () => {
    expect(valorAbreviado(999)).toBe('999')
    expect(valorAbreviado(0)).toBe('0')
  })

  it('trata negativo pela magnitude, não pelo sinal', () => {
    expect(valorAbreviado(-1_200_000)).toBe('-1,2 mi')
  })
})
