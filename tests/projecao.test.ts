import { describe, it, expect } from 'vitest'
import {
  calcularProjecao,
  classificarPorPrazo,
  somarMeses,
  diferencaMeses,
} from '@/lib/calculo/projecao'

describe('aritmética de mês', () => {
  it('soma atravessando a virada do ano', () => {
    expect(somarMeses('2026-07', 5)).toBe('2026-12')
    expect(somarMeses('2026-07', 6)).toBe('2027-01')
    expect(somarMeses('2026-12', 1)).toBe('2027-01')
    expect(somarMeses('2026-01', 23)).toBe('2027-12')
  })

  it('subtrai atravessando a virada do ano', () => {
    expect(somarMeses('2027-01', -1)).toBe('2026-12')
    expect(somarMeses('2026-01', -1)).toBe('2025-12')
  })

  it('calcula diferença com sinal', () => {
    expect(diferencaMeses('2026-07', '2026-12')).toBe(5)
    expect(diferencaMeses('2026-07', '2027-07')).toBe(12)
    expect(diferencaMeses('2026-07', '2026-05')).toBe(-2)
    expect(diferencaMeses('2026-07', '2026-07')).toBe(0)
  })
})

describe('calcularProjecao', () => {
  // Cenário real: a planilha de julho traz parcelas de maio a dezembro/2026.
  const parcelas = [
    { mesReferencia: '2026-05', valor: 1000 }, // passado
    { mesReferencia: '2026-06', valor: 1000 }, // passado
    { mesReferencia: '2026-07', valor: 500 },
    { mesReferencia: '2026-08', valor: 500 },
    { mesReferencia: '2026-09', valor: 500 },
    { mesReferencia: '2026-10', valor: 500 },
    { mesReferencia: '2026-11', valor: 500 },
    { mesReferencia: '2026-12', valor: 500 },
  ]

  it('ignora parcelas anteriores ao mês de referência — são histórico', () => {
    const r = calcularProjecao(parcelas, '2026-07')
    expect(r.serie.map(m => m.mesReferencia)).toEqual([
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
    ])
    expect(r.totalGeral).toBe(3000) // não 5000
  })

  it('horizonte de 6 meses conta o mês inicial mais os 5 seguintes', () => {
    const r = calcularProjecao(parcelas, '2026-07')
    // 07,08,09,10,11,12 = 6 meses × 500
    expect(r.horizontes[6].total).toBe(3000)
    expect(r.horizontes[6].mesesComDados).toBe(6)
    expect(r.horizontes[6].incompleto).toBe(false)
  })

  it('MARCA como incompleto quando o horizonte vai além dos dados', () => {
    // Este é o ponto: um total de 24 meses calculado sobre 6 meses de dados
    // parece completo e não é. A janela ainda vai crescer nos próximos envios.
    const r = calcularProjecao(parcelas, '2026-07')
    expect(r.horizontes[12].incompleto).toBe(true)
    expect(r.horizontes[24].incompleto).toBe(true)
    // O total continua correto — só não é a história inteira.
    expect(r.horizontes[24].total).toBe(3000)
    expect(r.ultimoMesComDados).toBe('2026-12')
  })

  it('agrupa várias parcelas do mesmo mês e conta os casos', () => {
    const r = calcularProjecao(
      [
        { mesReferencia: '2026-07', valor: 300 },
        { mesReferencia: '2026-07', valor: 200 },
        { mesReferencia: '2026-08', valor: 100 },
      ],
      '2026-07'
    )
    const julho = r.serie.find(m => m.mesReferencia === '2026-07')!
    expect(julho.valor).toBe(500)
    expect(julho.casos).toBe(2)
  })

  it('sem parcela nenhuma devolve zeros e marca tudo como incompleto', () => {
    const r = calcularProjecao([], '2026-07')
    expect(r.totalGeral).toBe(0)
    expect(r.ultimoMesComDados).toBeNull()
    expect(r.horizontes[6].incompleto).toBe(true)
  })

  it('a série sai ordenada por mês', () => {
    const r = calcularProjecao(
      [
        { mesReferencia: '2027-01', valor: 1 },
        { mesReferencia: '2026-08', valor: 1 },
        { mesReferencia: '2026-12', valor: 1 },
      ],
      '2026-07'
    )
    expect(r.serie.map(m => m.mesReferencia)).toEqual(['2026-08', '2026-12', '2027-01'])
  })

  it('horizontes maiores nunca somam menos que os menores', () => {
    const r = calcularProjecao(parcelas, '2026-07')
    expect(r.horizontes[12].total).toBeGreaterThanOrEqual(r.horizontes[6].total)
    expect(r.horizontes[24].total).toBeGreaterThanOrEqual(r.horizontes[12].total)
  })
})

describe('classificarPorPrazo — §3.5', () => {
  const ref = new Date('2026-07-01T00:00:00Z')
  const emDias = (n: number) => new Date(ref.getTime() + n * 24 * 60 * 60 * 1000)

  it('as faixas são cumulativas: o que cabe em 45 dias também cabe em 90', () => {
    const r = classificarPorPrazo(
      [
        { data: emDias(10), valor: 100 },
        { data: emDias(60), valor: 200 },
        { data: emDias(120), valor: 400 },
      ],
      ref
    )
    expect(r.ate45Dias).toBe(100)
    expect(r.ate90Dias).toBe(300) // 100 + 200
    expect(r.totalAcumulado).toBe(700)
  })

  it('ignora desembolso já vencido', () => {
    const r = classificarPorPrazo([{ data: emDias(-10), valor: 999 }], ref)
    expect(r.totalAcumulado).toBe(0)
  })

  it('inclui o desembolso exatamente no limite', () => {
    const r = classificarPorPrazo([{ data: emDias(45), valor: 100 }], ref)
    expect(r.ate45Dias).toBe(100)
  })
})
