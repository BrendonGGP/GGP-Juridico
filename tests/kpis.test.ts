import { describe, it, expect } from 'vitest'
import {
  calcularTaxaExito,
  calcularBurnDown,
  calcularTempoMedio,
  calcularRecorrencia,
  calcularEfeitoTeses,
  calcularConcentracaoMga,
} from '@/lib/calculo/kpis'

const d = (s: string) => new Date(`${s}T00:00:00Z`)

describe('calcularTaxaExito', () => {
  it('mede o valor pedido que deixou de ser pago', () => {
    const r = calcularTaxaExito([
      {
        valorCausa: 100_000,
        valorAcordo: null,
        valorCondenacao: 30_000,
        encerrado: true,
        resultadoSentenca: 'Procedente',
      },
    ])
    expect(r.valorPedido).toBe(100_000)
    expect(r.valorDevido).toBe(30_000)
    expect(r.valorEconomizado).toBe(70_000)
    expect(r.percentual.valor).toBe(70)
  })

  it('REGRA 1: usa o acordo, nunca a soma com a condenação', () => {
    const r = calcularTaxaExito([
      {
        valorCausa: 100_000,
        valorAcordo: 20_000,
        valorCondenacao: 80_000,
        encerrado: true,
        resultadoSentenca: 'Acordo',
      },
    ])
    // Se somasse, valorDevido seria 100.000 e o êxito apareceria como 0%.
    expect(r.valorDevido).toBe(20_000)
    expect(r.percentual.valor).toBe(80)
  })

  it('exclui "Em andamento" — inflaria o percentual', () => {
    // Processo sem sentença tem condenação zero; incluí-lo daria 100% de êxito.
    const r = calcularTaxaExito([
      {
        valorCausa: 500_000,
        valorAcordo: null,
        valorCondenacao: null,
        encerrado: false,
        resultadoSentenca: 'Em andamento',
      },
    ])
    expect(r.percentual.valor).toBeNull()
    expect(r.processosComSentenca).toBe(0)
  })

  it('sem base devolve null com motivo, NUNCA zero', () => {
    const r = calcularTaxaExito([])
    expect(r.percentual.valor).toBeNull()
    expect(r.percentual.indisponivel).toBeTruthy()
    // Zero afirmaria "não houve êxito"; ausência de dado é outra coisa.
    expect(r.percentual.valor).not.toBe(0)
  })
})

describe('calcularBurnDown', () => {
  it('saldo positivo significa estoque diminuindo', () => {
    const r = calcularBurnDown(30, 10)
    expect(r.saldo).toBe(20)
    expect(r.razao.valor).toBe(3)
  })

  it('não divide por zero quando não entrou processo novo', () => {
    // "∞% de redução" num relatório executivo é pior que dizer que não se aplica.
    const r = calcularBurnDown(5, 0)
    expect(r.razao.valor).toBeNull()
    expect(r.razao.indisponivel).toContain('Nenhum processo novo')
    expect(r.saldo).toBe(5)
  })
})

describe('calcularTempoMedio', () => {
  it('usa Data do cadastro como início, validado com o Jurídico', () => {
    const r = calcularTempoMedio([
      { dataCadastro: d('2026-01-01'), dataEncerramento: d('2026-01-11') },
      { dataCadastro: d('2026-01-01'), dataEncerramento: d('2026-01-31') },
    ])
    expect(r.dias.valor).toBe(20) // (10 + 30) / 2
    expect(r.minimoDias).toBe(10)
    expect(r.maximoDias).toBe(30)
  })

  it('devolve mediana junto da média, que um caso extremo distorce', () => {
    const r = calcularTempoMedio([
      { dataCadastro: d('2026-01-01'), dataEncerramento: d('2026-01-11') },
      { dataCadastro: d('2026-01-01'), dataEncerramento: d('2026-01-11') },
      { dataCadastro: d('2010-01-01'), dataEncerramento: d('2026-01-01') },
    ])
    expect(r.dias.valor!).toBeGreaterThan(1900) // média puxada pelo caso de 16 anos
    expect(r.medianaDias).toBe(10) // mediana revela o tempo típico
  })

  it('ignora processo sem uma das datas', () => {
    const r = calcularTempoMedio([
      { dataCadastro: d('2026-01-01'), dataEncerramento: null },
      { dataCadastro: null, dataEncerramento: d('2026-01-11') },
      { dataCadastro: d('2026-01-01'), dataEncerramento: d('2026-01-11') },
    ])
    expect(r.dias.base).toBe(1)
  })

  it('descarta encerramento anterior ao cadastro — é erro de dado', () => {
    const r = calcularTempoMedio([
      { dataCadastro: d('2026-06-01'), dataEncerramento: d('2026-01-01') },
    ])
    expect(r.dias.valor).toBeNull()
  })

  it('sem base devolve null com motivo', () => {
    const r = calcularTempoMedio([])
    expect(r.dias.valor).toBeNull()
    expect(r.dias.indisponivel).toBeTruthy()
  })
})

describe('calcularRecorrencia', () => {
  it('agrupa grafias equivalentes mas exibe a mais frequente', () => {
    // Sem normalizar, "Colisão" e "colisão " apareceriam como motivos distintos.
    const r = calcularRecorrencia(['Colisão', 'colisão ', 'COLISÃO', 'Incêndio'])
    expect(r.itens[0].rotulo).toBe('Colisão')
    expect(r.itens[0].quantidade).toBe(3)
    expect(r.itens[0].percentual).toBe(75)
  })

  it('conta os sem classificação à parte, sem diluir os percentuais', () => {
    const r = calcularRecorrencia(['Colisão', null, '', '   '])
    expect(r.semClassificacao).toBe(3)
    expect(r.total).toBe(1)
    expect(r.itens[0].percentual).toBe(100)
  })

  it('respeita o limite e ordena por quantidade', () => {
    const r = calcularRecorrencia(['a', 'a', 'a', 'b', 'b', 'c'], 2)
    expect(r.itens.map(i => i.rotulo)).toEqual(['a', 'b'])
  })
})

describe('calcularEfeitoTeses — o polo decide o que é vitória', () => {
  const casos = (n: number, resultado: string, polo: string) =>
    Array.from({ length: n }, () => ({
      motivoSinistro: 'Embriaguez ao volante',
      resultadoSentenca: resultado,
      poloCliente: polo,
    }))

  it('no polo PASSIVO, improcedência é VITÓRIA nossa', () => {
    // 726 dos 799 processos reais estão no polo passivo.
    const r = calcularEfeitoTeses(casos(3, 'Improcedente', 'Passiva'))
    expect(r[0].ganhos).toBe(3)
    expect(r[0].perdas).toBe(0)
    expect(r[0].taxaGanho.valor).toBe(100)
  })

  it('no polo ATIVO, procedência é que é vitória', () => {
    // Inverter isto faria o indicador apontar a tese errada como vencedora.
    const r = calcularEfeitoTeses(casos(3, 'Procedente', 'Ativa'))
    expect(r[0].ganhos).toBe(3)
    expect(r[0].perdas).toBe(0)
  })

  it('o mesmo resultado tem sentido oposto conforme o polo', () => {
    const passivo = calcularEfeitoTeses(casos(3, 'Procedente', 'Passiva'))
    const ativo = calcularEfeitoTeses(casos(3, 'Procedente', 'Ativa'))
    expect(passivo[0].perdas).toBe(3)
    expect(ativo[0].ganhos).toBe(3)
  })

  it('"Parcialmente Procedente" fica à parte, não é forçado para um lado', () => {
    const r = calcularEfeitoTeses(casos(3, 'Parcialmente Procedente', 'Passiva'))
    expect(r[0].parciais).toBe(3)
    expect(r[0].ganhos).toBe(0)
    expect(r[0].perdas).toBe(0)
    expect(r[0].taxaGanho.valor).toBeNull()
  })

  it('ignora motivo com poucos casos — não sustenta conclusão sobre tese', () => {
    const r = calcularEfeitoTeses([
      { motivoSinistro: 'Raro', resultadoSentenca: 'Improcedente', poloCliente: 'Passiva' },
      { motivoSinistro: 'Raro', resultadoSentenca: 'Improcedente', poloCliente: 'Passiva' },
    ])
    expect(r).toHaveLength(0)
  })

  it('ignora processo sem motivo ou sem resultado', () => {
    const r = calcularEfeitoTeses([
      ...casos(3, 'Improcedente', 'Passiva'),
      { motivoSinistro: null, resultadoSentenca: 'Improcedente', poloCliente: 'Passiva' },
      { motivoSinistro: 'Embriaguez ao volante', resultadoSentenca: null, poloCliente: 'Passiva' },
    ])
    expect(r[0].total).toBe(3)
  })
})

describe('calcularConcentracaoMga', () => {
  it('ranqueia quem concentra mais demanda e conta os sem M.G.A', () => {
    // 770 das 799 linhas reais têm M.G.A ausente — é esperado.
    const r = calcularConcentracaoMga(['Seven Seguros', 'Seven Seguros', 'Lince', null, null])
    expect(r.itens[0].rotulo).toBe('Seven Seguros')
    expect(r.itens[0].quantidade).toBe(2)
    expect(r.semMga).toBe(2)
  })
})
