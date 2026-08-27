import { describe, it, expect } from 'vitest'
import {
  calcularTop,
  ehTrabalhista,
  ehIdpj,
  valorParaRanqueamento,
  type ProcessoParaRanquear,
} from '@/lib/calculo/top-processos'

let seq = 0
function proc(over: Partial<ProcessoParaRanquear> = {}): ProcessoParaRanquear {
  seq++
  return {
    id: `id-${seq}`,
    numeroProcesso: `000${seq}-00.2026.8.13.0001`,
    carteira: 'SEVEN INSURTECH',
    area: 'Cível',
    tipoAcao: 'Cobrança',
    risco: 'PROVAVEL',
    encerrado: false,
    valorCausa: null,
    valorAcordo: null,
    valorCondenacao: null,
    valorProvisionado: 200_000,
    ...over,
  }
}

describe('ehTrabalhista — REGRA 7', () => {
  it('usa Area, e pega o caso que Tipo de Ação perderia', () => {
    // Casos reais: Area = Trabalhista com Tipo de Ação = "Mandado de Segurança".
    // Um filtro por tipoAcao perderia exatamente esses.
    expect(ehTrabalhista('Trabalhista')).toBe(true)
    expect(ehTrabalhista('TRABALHISTA')).toBe(true)
    expect(ehTrabalhista('Cível')).toBe(false)
    expect(ehTrabalhista(null)).toBe(false)
  })

  it('o processo entra na lista mesmo com Tipo de Ação sem a palavra', () => {
    const r = calcularTop([
      proc({ area: 'Trabalhista', tipoAcao: 'Mandado de Segurança', valorProvisionado: 1000 }),
    ])
    expect(r.trabalhistaEIdpj).toHaveLength(1)
  })
})

describe('ehIdpj', () => {
  it('reconhece o valor completo e a sigla', () => {
    expect(ehIdpj('Incidente de Desconsideração da Personalidade Jurídica')).toBe(true)
    expect(ehIdpj('IDPJ')).toBe(true)
    expect(ehIdpj('Cobrança')).toBe(false)
    expect(ehIdpj(null)).toBe(false)
  })

  it('não confunde palavra que apenas contém as letras', () => {
    expect(ehIdpj('Ação Ordinária')).toBe(false)
  })
})

describe('valorParaRanqueamento — REGRA 1', () => {
  it('acordo vence condenação, e nunca soma', () => {
    const r = valorParaRanqueamento(
      proc({ valorAcordo: 30_000, valorCondenacao: 100_000 })
    )
    expect(r.valor).toBe(30_000)
    expect(r.origem).toBe('acordo')
    expect(r.valor).not.toBe(130_000)
  })

  it('cai para provisionado e depois para causa, sempre dizendo a origem', () => {
    expect(valorParaRanqueamento(proc({ valorProvisionado: 50_000 })).origem).toBe('provisionado')
    expect(
      valorParaRanqueamento(proc({ valorProvisionado: null, valorCausa: 70_000 })).origem
    ).toBe('causa')
    expect(
      valorParaRanqueamento(proc({ valorProvisionado: null, valorCausa: null })).origem
    ).toBe('nenhum')
  })

  it('acordo ZERO cai para o provisionado — não trava o ranking em zero', () => {
    // 743 dos 799 processos ativos reais têm Valor do Acordo = 0, não vazio.
    // Tratar isso como "valor decidido" fazia o Top ter 5 itens em vez de dezenas.
    const r = valorParaRanqueamento(
      proc({ valorAcordo: 0, valorCondenacao: 0, valorProvisionado: 250_000 })
    )
    expect(r.valor).toBe(250_000)
    expect(r.origem).toBe('provisionado')
  })

  it('mas condenação positiva com acordo zero usa a condenação', () => {
    const r = valorParaRanqueamento(
      proc({ valorAcordo: 0, valorCondenacao: 180_000, valorProvisionado: 999_999 })
    )
    expect(r.valor).toBe(180_000)
    expect(r.origem).toBe('condenacao')
  })

  it('ranquear por tamanho não altera a regra de quanto se deve', () => {
    // São perguntas diferentes. calcularValorDevido continua tratando 0 como
    // valor legítimo — lá, zero significa "nada a pagar", e está correto.
    const r = valorParaRanqueamento(
      proc({ valorAcordo: 0, valorCondenacao: null, valorProvisionado: null, valorCausa: null })
    )
    expect(r.valor).toBe(0)
    expect(r.origem).toBe('nenhum')
  })
})

describe('calcularTop — Top 20 por valor', () => {
  it('corta em 20, mesmo com mais elegíveis', () => {
    const muitos = Array.from({ length: 30 }, (_, i) =>
      proc({ valorProvisionado: 200_000 + i })
    )
    const r = calcularTop(muitos)
    expect(r.topPorValor).toHaveLength(20)
    expect(r.elegiveisAoTop).toBe(30)
  })

  it('ordena por valor decrescente', () => {
    const r = calcularTop([
      proc({ valorProvisionado: 150_000 }),
      proc({ valorProvisionado: 500_000 }),
      proc({ valorProvisionado: 300_000 }),
    ])
    expect(r.topPorValor.map(p => p.valorRanqueamento)).toEqual([500_000, 300_000, 150_000])
  })

  it('exige valor ACIMA de R$ 100 mil', () => {
    const r = calcularTop([
      proc({ valorProvisionado: 100_000 }), // exatamente no limite: fora
      proc({ valorProvisionado: 100_001 }),
    ])
    expect(r.topPorValor).toHaveLength(1)
    expect(r.topPorValor[0].valorRanqueamento).toBe(100_001)
  })

  it('aceita só risco Provável e Possível', () => {
    const r = calcularTop([
      proc({ risco: 'PROVAVEL' }),
      proc({ risco: 'POSSIVEL' }),
      proc({ risco: 'REMOTO' }),
      proc({ risco: null }),
    ])
    expect(r.topPorValor).toHaveLength(2)
  })

  it('exclui processo encerrado', () => {
    const r = calcularTop([proc({ encerrado: true, valorProvisionado: 999_999 })])
    expect(r.topPorValor).toHaveLength(0)
  })

  it('a ordem é estável entre execuções', () => {
    // Sem desempate determinístico, o relatório mudaria de ordem a cada geração.
    const iguais = [
      proc({ valorProvisionado: 200_000, numeroProcesso: 'B' }),
      proc({ valorProvisionado: 200_000, numeroProcesso: 'A' }),
    ]
    const a = calcularTop(iguais).topPorValor.map(p => p.numeroProcesso)
    const b = calcularTop([...iguais].reverse()).topPorValor.map(p => p.numeroProcesso)
    expect(a).toEqual(b)
    expect(a).toEqual(['A', 'B'])
  })
})

describe('calcularTop — lista de Trabalhista + IDPJ', () => {
  it('NÃO tem limite de 20', () => {
    const muitos = Array.from({ length: 35 }, () =>
      proc({ area: 'Trabalhista', valorProvisionado: 1000 })
    )
    const r = calcularTop(muitos)
    expect(r.trabalhistaEIdpj).toHaveLength(35)
  })

  it('inclui independentemente do valor', () => {
    // O motivo de acompanhá-los é a natureza jurídica, não o valor financeiro.
    const r = calcularTop([proc({ area: 'Trabalhista', valorProvisionado: 1 })])
    expect(r.trabalhistaEIdpj).toHaveLength(1)
    expect(r.topPorValor).toHaveLength(0)
  })

  it('inclui IDPJ pelo Tipo de Ação', () => {
    const r = calcularTop([
      proc({
        area: 'Cível',
        tipoAcao: 'Incidente de Desconsideração da Personalidade Jurídica',
        valorProvisionado: 500,
      }),
    ])
    expect(r.trabalhistaEIdpj).toHaveLength(1)
    expect(r.trabalhistaEIdpj[0].ehIdpj).toBe(true)
  })

  it('exclui encerrados também aqui', () => {
    const r = calcularTop([proc({ area: 'Trabalhista', encerrado: true })])
    expect(r.trabalhistaEIdpj).toHaveLength(0)
  })
})

describe('as duas listas são INDEPENDENTES', () => {
  it('um Trabalhista grande aparece nas DUAS', () => {
    // Ele não é excluído do Top 20 por ser Trabalhista; só não é mais forçado
    // a entrar nele independente do valor.
    const grande = proc({ area: 'Trabalhista', valorProvisionado: 900_000 })
    const r = calcularTop([grande])
    expect(r.topPorValor).toHaveLength(1)
    expect(r.trabalhistaEIdpj).toHaveLength(1)
    expect(r.topPorValor[0].id).toBe(r.trabalhistaEIdpj[0].id)
  })

  it('Trabalhista pequeno NÃO ocupa vaga no Top 20', () => {
    // Era o problema do desenho antigo: 30+ trabalhistas empurravam para fora
    // os casos grandes não-trabalhistas.
    const trabalhistas = Array.from({ length: 30 }, () =>
      proc({ area: 'Trabalhista', valorProvisionado: 5000 })
    )
    const grandes = Array.from({ length: 20 }, (_, i) =>
      proc({ area: 'Cível', valorProvisionado: 500_000 + i })
    )
    const r = calcularTop([...trabalhistas, ...grandes])

    expect(r.topPorValor).toHaveLength(20)
    expect(r.topPorValor.every(p => !p.ehTrabalhista)).toBe(true)
    expect(r.trabalhistaEIdpj).toHaveLength(30)
  })
})
