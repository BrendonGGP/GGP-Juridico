import { describe, it, expect } from 'vitest'
import {
  calcularProvisionamento,
  calcularTodosCenarios,
  MATRIZ_CENARIOS,
  type ProcessoParaProvisionar,
} from '@/lib/calculo/cenarios'

const p = (
  risco: ProcessoParaProvisionar['risco'],
  valorProvisionado: number | null,
  encerrado = false
): ProcessoParaProvisionar => ({ risco, valorProvisionado, encerrado })

describe('MATRIZ_CENARIOS — a regra de negócio inteira', () => {
  it('bate exatamente com a especificação validada com o Jurídico', () => {
    // Errar um percentual aqui muda o passivo declarado do grupo.
    expect(MATRIZ_CENARIOS.CONSERVADOR).toEqual({ PROVAVEL: 1.0, POSSIVEL: 1.0, REMOTO: 0.25 })
    expect(MATRIZ_CENARIOS.REALISTA).toEqual({ PROVAVEL: 1.0, POSSIVEL: 0.5, REMOTO: 0.0 })
    expect(MATRIZ_CENARIOS.OTIMISTA).toEqual({ PROVAVEL: 0.5, POSSIVEL: 0.0, REMOTO: 0.0 })
  })

  it('conservador nunca reconhece menos que realista, que nunca reconhece menos que otimista', () => {
    for (const risco of ['PROVAVEL', 'POSSIVEL', 'REMOTO'] as const) {
      expect(MATRIZ_CENARIOS.CONSERVADOR[risco]).toBeGreaterThanOrEqual(
        MATRIZ_CENARIOS.REALISTA[risco]
      )
      expect(MATRIZ_CENARIOS.REALISTA[risco]).toBeGreaterThanOrEqual(
        MATRIZ_CENARIOS.OTIMISTA[risco]
      )
    }
  })
})

describe('calcularProvisionamento', () => {
  const carteira = [
    p('PROVAVEL', 100_000),
    p('PROVAVEL', 100_000),
    p('POSSIVEL', 200_000),
    p('REMOTO', 400_000),
  ]

  it('CONSERVADOR: 100% provável, 100% possível, 25% remoto', () => {
    const r = calcularProvisionamento(carteira, 'CONSERVADOR')
    // 200.000 + 200.000 + 100.000 = 500.000
    expect(r.totalProvisionado).toBe(500_000)
    expect(r.totalBruto).toBe(800_000)
    expect(r.totalCasos).toBe(4)
  })

  it('REALISTA: 100% provável, 50% possível, 0% remoto', () => {
    const r = calcularProvisionamento(carteira, 'REALISTA')
    // 200.000 + 100.000 + 0 = 300.000
    expect(r.totalProvisionado).toBe(300_000)
  })

  it('OTIMISTA: 50% provável, o resto zerado', () => {
    const r = calcularProvisionamento(carteira, 'OTIMISTA')
    // 100.000 + 0 + 0 = 100.000
    expect(r.totalProvisionado).toBe(100_000)
  })

  it('agrupa casos e valores por risco', () => {
    const r = calcularProvisionamento(carteira, 'CONSERVADOR')
    const provavel = r.grupos.find(g => g.risco === 'PROVAVEL')!
    expect(provavel.casos).toBe(2)
    expect(provavel.valorBruto).toBe(200_000)
    expect(provavel.percentualAplicado).toBe(1.0)
    expect(provavel.valorProvisionado).toBe(200_000)

    const remoto = r.grupos.find(g => g.risco === 'REMOTO')!
    expect(remoto.valorBruto).toBe(400_000)
    expect(remoto.valorProvisionado).toBe(100_000)
  })

  it('sempre devolve os três grupos, mesmo vazios', () => {
    const r = calcularProvisionamento([p('PROVAVEL', 1000)], 'REALISTA')
    expect(r.grupos.map(g => g.risco)).toEqual(['PROVAVEL', 'POSSIVEL', 'REMOTO'])
    expect(r.grupos.find(g => g.risco === 'REMOTO')!.casos).toBe(0)
  })
})

describe('calcularProvisionamento — o que fica de fora', () => {
  it('processo ENCERRADO não carrega risco em aberto', () => {
    const r = calcularProvisionamento(
      [p('PROVAVEL', 100_000), p('PROVAVEL', 999_999, true)],
      'CONSERVADOR'
    )
    expect(r.totalProvisionado).toBe(100_000)
    expect(r.excluidos.encerrados).toBe(1)
  })

  it('risco ausente é EXCLUÍDO e contado, nunca tratado como REMOTO', () => {
    // Um default silencioso de REMOTO faria o passivo aparecer menor do que é.
    const r = calcularProvisionamento(
      [p('PROVAVEL', 100_000), p(null, 500_000)],
      'CONSERVADOR'
    )
    expect(r.totalProvisionado).toBe(100_000)
    expect(r.excluidos.semRisco).toBe(1)
    expect(r.totalCasos).toBe(1)
  })

  it('valor ausente é excluído e contado', () => {
    const r = calcularProvisionamento(
      [p('PROVAVEL', 100_000), p('PROVAVEL', null)],
      'CONSERVADOR'
    )
    expect(r.totalProvisionado).toBe(100_000)
    expect(r.excluidos.semValor).toBe(1)
  })

  it('a exclusão é sempre declarada — nunca soma como zero em silêncio', () => {
    const r = calcularProvisionamento(
      [p(null, 1), p('PROVAVEL', null), p('PROVAVEL', 1, true)],
      'REALISTA'
    )
    expect(r.excluidos).toEqual({ encerrados: 1, semRisco: 1, semValor: 1 })
    expect(r.totalCasos).toBe(0)
  })

  it('BAIXADOS, que não traz risco nem valor, não quebra o cálculo', () => {
    const r = calcularProvisionamento([p(null, null, true)], 'CONSERVADOR')
    expect(r.totalProvisionado).toBe(0)
    expect(r.excluidos.encerrados).toBe(1)
  })
})

describe('calcularTodosCenarios', () => {
  it('otimista <= realista <= conservador para a mesma carteira', () => {
    const carteira = [p('PROVAVEL', 100_000), p('POSSIVEL', 200_000), p('REMOTO', 400_000)]
    const t = calcularTodosCenarios(carteira)
    expect(t.OTIMISTA.totalProvisionado).toBeLessThanOrEqual(t.REALISTA.totalProvisionado)
    expect(t.REALISTA.totalProvisionado).toBeLessThanOrEqual(t.CONSERVADOR.totalProvisionado)
  })

  it('carteira vazia devolve zeros sem quebrar', () => {
    const t = calcularTodosCenarios([])
    for (const c of ['CONSERVADOR', 'REALISTA', 'OTIMISTA'] as const) {
      expect(t[c].totalProvisionado).toBe(0)
      expect(t[c].totalCasos).toBe(0)
    }
  })
})
