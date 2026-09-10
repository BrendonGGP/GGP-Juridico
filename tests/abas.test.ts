/**
 * Classificação das abas da planilha.
 *
 * Este teste existe por causa de uma falha real em agosto/2026: três abas
 * legítimas foram renomeadas pelo escritório e caíram como DESCONHECIDA,
 * porque a classificação comparava o nome inteiro. A base gravou 343
 * processos em vez de ~800 — um número menor, com cara de correto.
 *
 * Os nomes reais de junho, julho e agosto estão travados aqui. Quando o mês
 * seguinte trouxer outra redação, este é o lugar de registrá-la.
 */
import { describe, it, expect } from 'vitest'
import { classificarAba, exigeDesmembramento, carteiraDaAba } from '@/lib/ingestao/abas'

describe('abas de carteira, nas redações reais', () => {
  /** Nome como veio na planilha -> mês em que apareceu. */
  const CARTEIRAS: [string, string][] = [
    ['DEMAIS SEVEN, PEDRO, FABIANA...', 'julho'],
    ['DEMAIS SEVEN, PEDRO, SAMUEL...', 'agosto'],
    ['SPLIT RISK SEGURADORA S.A', 'julho e agosto'],
    ['REGRESSIVAS DE COBRANÇA - SPLIT', 'julho'],
    ['REGRESSIVAS SPLIT RISK', 'agosto'],
    ['SEVEN INSURTECH', 'julho'],
    ['INSURTECH', 'agosto'],
  ]

  for (const [nome, mes] of CARTEIRAS) {
    it(`reconhece "${nome}" (${mes})`, () => {
      expect(classificarAba(nome)).toBe('CARTEIRA')
    })
  }
})

describe('abas especiais', () => {
  it('reconhece GERAL', () => {
    expect(classificarAba('GERAL')).toBe('GERAL')
  })

  it('reconhece BAIXADOS em qualquer redação', () => {
    // Mudou de "ÚLTIMO SEMESTRE" (junho) para "ULTIMOS 3 MESES" (julho).
    expect(classificarAba('BAIXADOS ÚLTIMO SEMESTRE')).toBe('BAIXADOS')
    expect(classificarAba('BAIXADOS ULTIMOS 3 MESES')).toBe('BAIXADOS')
  })

  it('reconhece ACORDOS', () => {
    expect(classificarAba('ACORDOS')).toBe('ACORDOS')
  })
})

describe('aba desconhecida continua virando pendência', () => {
  it('não ingere aba que não casa com nenhum padrão', () => {
    // A lista é de PERMISSÃO. Afrouxar isso para "aceitar tudo" resolveria o
    // problema de agosto criando outro pior: carteira nova entrando sem que
    // ninguém perceba.
    expect(classificarAba('PLANILHA DE CONTROLE INTERNO')).toBe('DESCONHECIDA')
    expect(classificarAba('Plan1')).toBe('DESCONHECIDA')
    expect(classificarAba('')).toBe('DESCONHECIDA')
  })
})

describe('desmembramento por cliente', () => {
  it('exige desmembrar a aba "DEMAIS...", nas duas redações', () => {
    // Mistura 8 clientes; a carteira sai da coluna Cliente de cada linha.
    expect(exigeDesmembramento('DEMAIS SEVEN, PEDRO, FABIANA...')).toBe(true)
    expect(exigeDesmembramento('DEMAIS SEVEN, PEDRO, SAMUEL...')).toBe(true)
  })

  it('não desmembra aba de empresa única', () => {
    expect(exigeDesmembramento('SPLIT RISK SEGURADORA S.A')).toBe(false)
    expect(exigeDesmembramento('INSURTECH')).toBe(false)
  })

  it('carteiraDaAba devolve null só para a aba multi-cliente', () => {
    expect(carteiraDaAba('DEMAIS SEVEN, PEDRO, SAMUEL...')).toBeNull()
    expect(carteiraDaAba('INSURTECH')).toBe('INSURTECH')
  })
})

describe('ordem dos padrões', () => {
  it('classifica "REGRESSIVAS SPLIT RISK" como regressivas, não como a seguradora', () => {
    // Os dois padrões casariam: o nome contém "regressivas" E "split". O
    // primeiro do array vence, e é isso que mantém as duas carteiras
    // distintas — elas têm naturezas diferentes.
    expect(classificarAba('REGRESSIVAS SPLIT RISK')).toBe('CARTEIRA')
    expect(carteiraDaAba('REGRESSIVAS SPLIT RISK')).toBe('REGRESSIVAS SPLIT RISK')
  })
})
