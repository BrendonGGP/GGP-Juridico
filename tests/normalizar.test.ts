import { describe, it, expect } from 'vitest'
import {
  parseTexto,
  parseData,
  parseNumero,
  parseSimNao,
  parseRisco,
  parseExito,
} from '@/lib/ingestao/normalizar'

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

describe('parseTexto', () => {
  it('remove o espaço à direita do Status real ("ATIVO " vs "ATIVO")', () => {
    // Na planilha de julho: 742x "ATIVO " e 11x "ATIVO". Sem trim, um filtro
    // por status perderia um dos dois grupos.
    expect(parseTexto('ATIVO ').valor).toBe('ATIVO')
    expect(parseTexto('ATIVO').valor).toBe('ATIVO')
    expect(parseTexto('SUSPENSO ').valor).toBe('SUSPENSO')
    expect(parseTexto('BAIXADO ').valor).toBe('BAIXADO')
  })

  it('trata "N/A" como ausência, não como texto', () => {
    expect(parseTexto('N/A').valor).toBeNull()
    expect(parseTexto('n/a').valor).toBeNull()
    expect(parseTexto('NA').valor).toBeNull()
    expect(parseTexto('').valor).toBeNull()
    expect(parseTexto('   ').valor).toBeNull()
  })

  it('colapsa espaços internos vindos de texto quebrado na célula', () => {
    expect(parseTexto('Dano  moral  não   concedido').valor).toBe(
      'Dano moral não concedido'
    )
  })
})

describe('parseData — os dois formatos convivem NA MESMA coluna', () => {
  it('lê texto DD/MM/AAAA', () => {
    expect(iso(parseData('15/07/2026').valor)).toBe('2026-07-15')
    expect(iso(parseData('1/7/2026').valor)).toBe('2026-07-01')
  })

  it('lê Date do Excel', () => {
    expect(iso(parseData(new Date(2026, 6, 15)).valor)).toBe('2026-07-15')
  })

  it('não desloca a data por fuso — o Brasil é UTC negativo', () => {
    // Se a hora local fosse preservada, 01/07 viraria 30/06 ao serializar.
    const r = parseData(new Date(2026, 6, 1, 0, 0, 0))
    expect(iso(r.valor)).toBe('2026-07-01')
    expect(r.valor?.getUTCHours()).toBe(0)
  })

  it('lê serial numérico do Excel', () => {
    // Âncoras conferidas: o serial do Excel conta a partir de 1899-12-30.
    expect(iso(parseData(45658).valor)).toBe('2025-01-01')
    // 45658 + 181 dias (jan31+fev28+mar31+abr30+mai31+jun30) = 01/07/2025.
    expect(iso(parseData(45839).valor)).toBe('2025-07-01')
  })

  it('rejeita serial fora da faixa plausível', () => {
    // Protege contra ler um VALOR como se fosse data por engano de coluna.
    expect(parseData(0).motivo).toContain('fora da faixa')
    expect(parseData(999999).motivo).toContain('fora da faixa')
  })

  it('trata "N/A" como ausência SEM gerar pendência', () => {
    // 575 das 799 linhas têm data_condenacao = "N/A". É esperado, não é erro.
    const r = parseData('N/A')
    expect(r.valor).toBeNull()
    expect(r.motivo).toBeUndefined()
  })

  it('rejeita data inexistente em vez de rolar silenciosamente', () => {
    // new Date(2026, 1, 31) viraria 03/03 sem esta checagem.
    const r = parseData('31/02/2026')
    expect(r.valor).toBeNull()
    expect(r.motivo).toContain('inexistente')
  })

  it('reporta formato desconhecido como pendência, sem lançar', () => {
    const r = parseData('julho de 2026')
    expect(r.valor).toBeNull()
    expect(r.motivo).toContain('não reconhecido')
  })

  it('absorve o espaço injetado dentro do número (coluna Citação real)', () => {
    // 1100+ linhas reais têm espaço no meio do ano ou do dia. É artefato de
    // formatação da planilha, não ambiguidade — o valor é inequívoco.
    expect(iso(parseData('27/07/20 17').valor)).toBe('2017-07-27')
    expect(iso(parseData('2020-10- 15').valor)).toBe('2020-10-15')
    expect(iso(parseData('  27/07/20 17  ').valor)).toBe('2017-07-27')
    expect(iso(parseData('27/07/20 17.').valor)).toBe('2017-07-27')
  })

  it('aceita ponto como separador de data', () => {
    expect(iso(parseData('27.07.20 17').valor)).toBe('2017-07-27')
    expect(iso(parseData('27.07.2017').valor)).toBe('2017-07-27')
  })

  it('"Ainda não fomos citados" é ausência de data, não erro', () => {
    // 240 linhas reais. O processo existe; a citação não ocorreu.
    const r = parseData('Ainda não fomos citados')
    expect(r.valor).toBeNull()
    expect(r.motivo).toBeUndefined()
  })

  it('NÃO adivinha ano de 2 dígitos', () => {
    // "24/11/22" — 1922 ou 2022? Contexto sugere 2022, mas adivinhar num
    // sistema de provisionamento jurídico não é aceitável. Vira pendência.
    const r = parseData('24/11/22')
    expect(r.valor).toBeNull()
    expect(r.motivo).toContain('não reconhecido')
  })

  it('NÃO completa data sem dia', () => {
    // "04/2025" — inventar o dia mudaria cálculo de prazo e de duração.
    const r = parseData('04/2025')
    expect(r.valor).toBeNull()
    expect(r.motivo).toBeTruthy()
  })

  it('a limpeza de espaço não cria data falsa a partir de lixo', () => {
    expect(parseData('27/07/20 1789').motivo).toBeTruthy()
    expect(parseData('SEM NUMERO').motivo).toBeTruthy()
    expect(parseData('a b c').motivo).toBeTruthy()
  })
})

describe('parseNumero', () => {
  it('lê número puro — é como os valores vêm nas planilhas reais', () => {
    expect(parseNumero(12345.67).valor).toBe(12345.67)
    expect(parseNumero(0).valor).toBe(0)
  })

  it('lê pt-BR e en-US', () => {
    expect(parseNumero('1.234,56').valor).toBe(1234.56)
    expect(parseNumero('1,234.56').valor).toBe(1234.56)
    expect(parseNumero('R$ 12.345,67').valor).toBe(12345.67)
  })

  it('RECUSA separador decimal ambíguo em vez de chutar', () => {
    // "12.345.67" apareceu 8x no Êxito real. Pode ser 12345.67 ou 1234567 —
    // um fator de 100 no passivo. Chutar aqui é pior que reportar.
    const r = parseNumero('R$ 12.345.67')
    expect(r.valor).toBeNull()
    expect(r.motivo).toContain('ambíguo')
  })

  it('trata 0 como valor legítimo, não como ausência', () => {
    expect(parseNumero(0).valor).toBe(0)
    expect(parseNumero('0,00').valor).toBe(0)
  })

  it('lê parênteses como negativo (convenção contábil)', () => {
    expect(parseNumero('(1.234,56)').valor).toBe(-1234.56)
  })

  it('reporta texto não numérico como pendência', () => {
    const r = parseNumero('a combinar')
    expect(r.valor).toBeNull()
    expect(r.motivo).toContain('não é um número')
  })
})

describe('parseSimNao — tri-estado, não booleano', () => {
  it('lê SIM e NÃO', () => {
    expect(parseSimNao('SIM').valor).toBe(true)
    expect(parseSimNao('NÃO').valor).toBe(false)
    expect(parseSimNao('nao').valor).toBe(false)
  })

  it('"N/A" é null, NUNCA false', () => {
    // 770 das 799 linhas. Significa "sem representante de seguros envolvido".
    // Virar false afirmaria que o M.G.A não está no polo passivo — outra coisa.
    const r = parseSimNao('N/A')
    expect(r.valor).toBeNull()
    expect(r.valor).not.toBe(false)
    expect(r.motivo).toBeUndefined()
  })
})

describe('parseRisco', () => {
  it('lê os três valores reais, com e sem acento', () => {
    expect(parseRisco('Provável').valor).toBe('PROVAVEL')
    expect(parseRisco('Possível').valor).toBe('POSSIVEL')
    expect(parseRisco('Remoto').valor).toBe('REMOTO')
    expect(parseRisco('PROVAVEL').valor).toBe('PROVAVEL')
  })

  it('NUNCA usa um padrão para risco desconhecido', () => {
    // O risco governa o provisionamento. Um default silencioso de "REMOTO"
    // faria o passivo aparecer menor do que é.
    const r = parseRisco('Altíssimo')
    expect(r.valor).toBeNull()
    expect(r.motivo).toContain('não reconhecido')
  })

  it('ausência é null sem pendência — BAIXADOS não traz risco', () => {
    expect(parseRisco('N/A').valor).toBeNull()
    expect(parseRisco('N/A').motivo).toBeUndefined()
    expect(parseRisco(null).valor).toBeNull()
  })
})

describe('parseExito — REGRA 2: valor curado, nunca recalculado', () => {
  it('aceita número puro (764 das 799 linhas reais)', () => {
    const r = parseExito(10000)
    expect(r.valor?.numerico).toBe(10000)
    expect(r.valor?.bruto).toBe('10000')
  })

  it('extrai o valor quando há UM só, e preserva o texto original', () => {
    const r = parseExito('R$ 12.345,67 - Dano moral não concedido')
    expect(r.valor?.numerico).toBe(12345.67)
    expect(r.valor?.bruto).toBe('R$ 12.345,67 - Dano moral não concedido')
    expect(r.valor?.motivo).toBeUndefined()
  })

  it('RECUSA quando há dois valores no mesmo campo', () => {
    // Real: "R$ X (Danos moral) + R$ Y (coparticipação)".
    // Somar seria inventar. Pegar o primeiro subestimaria em silêncio.
    const r = parseExito('R$ 12.345,67 (Danos moral) + R$ 890,12 (coparticipação)')
    expect(r.valor?.numerico).toBeNull()
    expect(r.valor?.motivo).toContain('2 valores monetários')
    // O texto original é preservado de qualquer forma.
    expect(r.valor?.bruto).toContain('coparticipação')
  })

  it('trata "R$" sem número como pendência, preservando o bruto', () => {
    const r = parseExito('R$')
    expect(r.valor?.numerico).toBeNull()
    expect(r.valor?.bruto).toBe('R$')
    expect(r.valor?.motivo).toBeTruthy()
  })

  it('preserva texto explicativo sem número como está', () => {
    const r = parseExito('0,00 - Sentença procedente.')
    expect(r.valor?.bruto).toBe('0,00 - Sentença procedente.')
    // Não tem "R$", então tenta ler como número puro e falha — vira pendência
    // com o texto intacto, que é o valor curado que o Jurídico quer ver.
    expect(r.valor?.numerico).toBeNull()
  })

  it('reporta o decimal ambíguo em vez de gravar valor errado', () => {
    const r = parseExito('R$ 12.345.67')
    expect(r.valor?.numerico).toBeNull()
    expect(r.valor?.motivo).toContain('ambíguo')
  })

  it('ausência é null', () => {
    expect(parseExito('N/A').valor).toBeNull()
    expect(parseExito('').valor).toBeNull()
  })
})
