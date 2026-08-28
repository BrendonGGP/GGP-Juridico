/**
 * Teste de CARACTERIZAÇÃO — trava os números da base real de julho/2026.
 *
 * Não valida se os números estão certos: isso já foi conferido à mão contra a
 * planilha. Valida que eles NÃO MUDAM.
 *
 * Existe para tornar refatoração segura. Os testes de unidade provam que cada
 * função faz o que se pediu com dados sintéticos; nenhum deles pega uma troca
 * sutil de origem de valor que alteraria o passivo em milhões. Este pega.
 *
 * Os valores abaixo foram capturados ANTES da refatoração de organização, com
 * o pipeline então em produção, e conferidos contra a fonte nas sessões de
 * validação da Fase 4.
 *
 * Se um destes números mudar, PARE. Ou a refatoração quebrou algo, ou a
 * planilha de referência foi trocada. Nos dois casos a resposta é investigar,
 * nunca atualizar o número esperado para o teste passar.
 *
 * PRIVACIDADE: só agregados. Nenhum processo é identificado.
 * Pulado quando dados-reais/ não existe (CI), como os demais testes de base real.
 */
import { describe, it, expect } from 'vitest'
import { painelDaBaseReal as painel, temBaseReal } from './apoio/base-real'

describe.skipIf(!temBaseReal)('números travados — base real de julho/2026', () => {
  it('a base tem 836 processos', () => {
    expect(painel().totalProcessos).toBe(836)
  })

  it('o provisionamento dos três cenários não mudou', () => {
    // Conferidos à mão contra a planilha. REGRA 1: acordo nunca somado à
    // condenação — se alguém somar, estes números explodem.
    const c = painel().cenarios
    expect(Math.round(c.CONSERVADOR.totalProvisionado)).toBe(24_539_607)
    expect(Math.round(c.REALISTA.totalProvisionado)).toBe(18_895_628)
    expect(Math.round(c.OTIMISTA.totalProvisionado)).toBe(6_748_663)
  })

  it('a decomposição do cenário Realista não mudou', () => {
    const grupos = painel().cenarios.REALISTA.grupos
    const por = (r: string) => grupos.find(g => g.risco === r)!

    expect(por('PROVAVEL').casos).toBe(229)
    expect(Math.round(por('PROVAVEL').valorBruto)).toBe(13_497_325)
    expect(por('POSSIVEL').casos).toBe(271)
    expect(Math.round(por('POSSIVEL').valorBruto)).toBe(10_796_606)
    expect(por('REMOTO').casos).toBe(299)
    expect(Math.round(por('REMOTO').valorProvisionado)).toBe(0)
  })

  it('os excluídos do provisionamento não mudaram', () => {
    // Nunca somados como zero: um passivo menor por falta de dado é pior que
    // um passivo com ressalva declarada.
    const r = painel().cenarios.REALISTA
    expect(r.totalCasos).toBe(799)
    expect(r.excluidos.encerrados).toBe(37)
    expect(r.excluidos.semRisco).toBe(0)
    expect(r.excluidos.semValor).toBe(0)
  })

  it('a projeção de desembolso não mudou', () => {
    const p = painel().projecao
    expect(Math.round(p.horizontes[6].total)).toBe(623_847)
    expect(Math.round(p.horizontes[12].total)).toBe(623_847)
    expect(p.ultimoMesComDados).toBe('2026-12')
    // 12 e 24 meses vão além da cobertura: o total é correto mas incompleto.
    expect(p.horizontes[12].incompleto).toBe(true)
    expect(p.horizontes[24].incompleto).toBe(true)
  })

  it('as duas listas do Top não mudaram', () => {
    const t = painel().top
    expect(t.topPorValor).toHaveLength(20)
    expect(t.elegiveisAoTop).toBe(34)
    expect(t.trabalhistaEIdpj).toHaveLength(34)
    expect(Math.round(t.topPorValor[0].valorRanqueamento)).toBe(900_000)
    expect(t.topPorValor[0].origemValor).toBe('provisionado')

    const idsNoTop = new Set(t.topPorValor.map(p => p.id))
    expect(t.trabalhistaEIdpj.filter(p => idsNoTop.has(p.id))).toHaveLength(11)
  })

  it('a taxa de êxito não mudou', () => {
    const e = painel().exito
    expect(e.percentual.valor).toBeCloseTo(86.9, 1)
    expect(e.percentual.base).toBe(392)
    expect(Math.round(e.valorPedido)).toBe(20_800_286)
    expect(Math.round(e.valorDevido)).toBe(2_725_815)
  })

  it('o tempo médio não mudou', () => {
    const t = painel().tempo
    expect(Math.round(t.dias.valor!)).toBe(329)
    expect(t.medianaDias).toBe(220)
    expect(t.dias.base).toBe(37)
  })

  it('a recorrência por tipo de ação não mudou', () => {
    const r = painel().recorrencia
    expect(r.total).toBe(836)
    expect(r.itens[0].rotulo).toBe('Indenizatória')
    expect(r.itens[0].quantidade).toBe(474)
    expect(r.itens[1].quantidade).toBe(124)
    expect(r.itens[2].quantidade).toBe(113)
  })

  it('a concentração por M.G.A não mudou', () => {
    const m = painel().mga
    expect(m.semMga).toBe(463)
    expect(m.itens[0].rotulo).toBe('Oceanica Brasil')
    expect(m.itens[0].quantidade).toBe(119)
    expect(m.itens[1].quantidade).toBe(101)
  })

  it('o efeito de teses não mudou', () => {
    // REGRA: o polo decide o que "procedente" significa. Se alguém ignorar o
    // polo, os ganhos e perdas se invertem em ~71 processos do polo ativo.
    const teses = painel().teses
    expect(teses).toHaveLength(20)
    const maior = teses[0]
    expect(maior.motivo).toBe('Divergência de informação')
    expect(maior.total).toBe(184)
    expect(maior.ganhos).toBe(10)
    expect(maior.perdas).toBe(10)
    expect(maior.parciais).toBe(49)
  })
})

describe.skipIf(temBaseReal)('números travados — base real', () => {
  it('pulado: dados-reais/ não está presente nesta máquina', () => {
    expect(temBaseReal).toBe(false)
  })
})
