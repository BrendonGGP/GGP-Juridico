import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { lerPlanilha } from '@/lib/ingestao/ler-planilha'

/**
 * Fixtures SINTÉTICAS. Dado real nunca entra em teste (ver CLAUDE.md), mas as
 * anomalias reproduzidas aqui são as observadas nas planilhas reais.
 */
function planilha(abas: Record<string, unknown[][]>): Buffer {
  const wb = XLSX.utils.book_new()
  for (const [nome, linhas] of Object.entries(abas)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), nome)
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/** Faixa de título mesclada que as planilhas reais têm na linha 1. */
const TITULO = ['RELATÓRIO ANALÍTICO DE TODOS OS PROCESSOS - JULHO/2026']

const CABECALHO = [
  'Nº', 'Ficha', 'Número do processo', 'Cliente', 'Area',
  'Tipo de Ação', 'Risco', 'Valor da causa', 'Status',
]
const linhaProcesso = (n: number, extra: Partial<Record<string, unknown>> = {}) => [
  n, `F${n}`, `000${n}-00.2026.8.13.0001`, 'Cliente Fictício', 'Cível',
  'Cobrança', extra.risco ?? 'Provável', extra.valor ?? 1000, 'ATIVO ',
]

describe('lerPlanilha — estrutura', () => {
  it('encontra o cabeçalho na linha 2, abaixo da faixa de título', () => {
    const buf = planilha({
      'SEVEN INSURTECH': [TITULO, CABECALHO, linhaProcesso(1)],
    })
    const r = lerPlanilha(buf)
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0].campos.numero_processo).toBe('0001-00.2026.8.13.0001')
    // Linha 3 do Excel: título(1) + cabeçalho(2) + dados(3).
    expect(r.linhas[0].linha).toBe(3)
  })

  it('REGRA 9 — a aba GERAL não vira registro', () => {
    const buf = planilha({
      GERAL: [TITULO, CABECALHO, linhaProcesso(1)],
      'SEVEN INSURTECH': [TITULO, CABECALHO, linhaProcesso(1)],
    })
    const r = lerPlanilha(buf)
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas.every(l => l.aba !== 'GERAL')).toBe(true)
    // Mas ela é LIDA, para a conferência de equivalência.
    expect(r.abasLidas.find(a => a.nome === 'GERAL')?.linhas).toBe(1)
  })

  it('REGRA 9 — acusa divergência entre GERAL e a união das carteiras', () => {
    const buf = planilha({
      GERAL: [TITULO, CABECALHO, linhaProcesso(1)], // 1 processo
      'SEVEN INSURTECH': [TITULO, CABECALHO, linhaProcesso(1), linhaProcesso(2)], // 2
    })
    const r = lerPlanilha(buf)
    const p = r.pendencias.find(p => p.tipo === 'GERAL_DIVERGENTE')
    expect(p).toBeDefined()
    expect(p!.detalhe).toContain('1 processos')
    expect(p!.detalhe).toContain('2')
  })

  it('BAIXADOS não entra na conferência da GERAL — senão alarme falso todo mês', () => {
    const buf = planilha({
      GERAL: [TITULO, CABECALHO, linhaProcesso(1)],
      'SEVEN INSURTECH': [TITULO, CABECALHO, linhaProcesso(1)],
      'BAIXADOS ULTIMOS 3 MESES': [TITULO, CABECALHO, linhaProcesso(9)],
    })
    const r = lerPlanilha(buf)
    expect(r.pendencias.filter(p => p.tipo === 'GERAL_DIVERGENTE')).toHaveLength(0)
  })

  it('REGRA 8 — linha de BAIXADOS vem marcada como encerrada', () => {
    const buf = planilha({
      'SEVEN INSURTECH': [TITULO, CABECALHO, linhaProcesso(1)],
      'BAIXADOS ULTIMOS 3 MESES': [TITULO, CABECALHO, linhaProcesso(2)],
    })
    const r = lerPlanilha(buf)
    expect(r.linhas.find(l => l.aba === 'SEVEN INSURTECH')!.encerrado).toBe(false)
    expect(r.linhas.find(l => l.aba.includes('BAIXADOS'))!.encerrado).toBe(true)
  })

  it('reconhece BAIXADOS por substring — o nome muda entre os meses', () => {
    for (const nome of ['BAIXADOS ULTIMOS 3 MESES', 'BAIXADOS ÚLTIMO SEMESTRE', 'Baixados 2027']) {
      const r = lerPlanilha(planilha({ [nome]: [TITULO, CABECALHO, linhaProcesso(1)] }))
      expect(r.linhas[0].encerrado).toBe(true)
    }
  })

  it('aba desconhecida vira pendência e NÃO é ingerida em silêncio', () => {
    const buf = planilha({
      'SEVEN INSURTECH': [TITULO, CABECALHO, linhaProcesso(1)],
      'CARTEIRA NOVA NAO AVISADA': [TITULO, CABECALHO, linhaProcesso(2)],
    })
    const r = lerPlanilha(buf)
    expect(r.linhas).toHaveLength(1)
    const p = r.pendencias.find(p => p.tipo === 'ABA_NAO_RECONHECIDA')
    expect(p).toBeDefined()
    expect(p!.aba).toBe('CARTEIRA NOVA NAO AVISADA')
  })

  it('a aba multi-cliente não recebe carteira fixa — precisa desmembrar', () => {
    const r = lerPlanilha(
      planilha({ 'DEMAIS SEVEN, PEDRO, FABIANA...': [TITULO, CABECALHO, linhaProcesso(1)] })
    )
    expect(r.linhas[0].carteira).toBeNull()

    const r2 = lerPlanilha(planilha({ 'SEVEN INSURTECH': [TITULO, CABECALHO, linhaProcesso(1)] }))
    expect(r2.linhas[0].carteira).toBe('SEVEN INSURTECH')
  })
})

describe('lerPlanilha — linha de total', () => {
  it('descarta a linha de total da planilha de Acordos', () => {
    const cab = ['Nº', 'Ficha', 'Número do processo', 'Valor do Acordo']
    const buf = planilha({
      'ACORDOS ATIVOS': [
        TITULO,
        cab,
        [1, 'F1', '0001-00.2026.8.13.0001', 5000],
        [2, 'F2', '0002-00.2026.8.13.0001', 3000],
        ['', '', '', 8000], // TOTAL: sem processo e sem ficha
      ],
    })
    const r = lerPlanilha(buf)
    expect(r.linhas).toHaveLength(2)
    const p = r.pendencias.find(p => p.tipo === 'LINHA_SEM_IDENTIFICADOR')
    expect(p).toBeDefined()
    expect(p!.linha).toBe(5)
  })

  it('detecta os pares de mês dinamicamente, sem número fixo de colunas', () => {
    const buf = planilha({
      'ACORDOS ATIVOS': [
        TITULO,
        [
          'Ficha', 'Número do processo',
          'DATA DE PAGAMENTO (MAIO/2026)', 'VALOR DA PARCELA (MAIO/2026)',
          'DATA DE PAGAMENTO (JUNHO/2026)', 'VALOR DA PARCELA (JUNHO/2026)',
        ],
        ['F1', '0001-00.2026.8.13.0001', '10/05/2026', 500, '10/06/2026', 500],
      ],
    })
    const r = lerPlanilha(buf)
    expect(r.mesesDetectados).toEqual(['2026-05', '2026-06'])
    // As colunas de mês não poluem o mapeamento de campos normais.
    expect(r.pendencias.filter(p => p.tipo === 'COLUNA_NAO_RECONHECIDA')).toHaveLength(0)
  })
})

describe('lerPlanilha — REGRA 10: pendência não trava o lote', () => {
  it('mantém a linha mesmo com célula impossível de interpretar', () => {
    const cab = [...CABECALHO, 'Data da Condenação']
    const buf = planilha({
      'SEVEN INSURTECH': [
        TITULO,
        cab,
        [...linhaProcesso(1), 'data que ninguém entende'],
        [...linhaProcesso(2), '15/07/2026'],
      ],
    })
    const r = lerPlanilha(buf)

    // As DUAS linhas foram aproveitadas.
    expect(r.linhas).toHaveLength(2)

    const ruim = r.linhas[0]
    expect(ruim.pendencias).toHaveLength(1)
    expect(ruim.pendencias[0].campo).toBe('data_condenacao')
    // O resto da linha continua íntegro.
    expect(ruim.campos.numero_processo).toBe('0001-00.2026.8.13.0001')
    expect(ruim.campos.valor_causa).toBe(1000)

    expect(r.linhas[1].pendencias).toHaveLength(0)
  })

  it('risco desconhecido vira pendência sem perder a linha', () => {
    const buf = planilha({
      'SEVEN INSURTECH': [TITULO, CABECALHO, linhaProcesso(1, { risco: 'Altíssimo' })],
    })
    const r = lerPlanilha(buf)
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0].campos.risco).toBeNull()
    expect(r.linhas[0].pendencias[0].campo).toBe('risco')
  })

  it('coluna sem mapeamento vira pendência de aba, sem descartar as demais', () => {
    const buf = planilha({
      'SEVEN INSURTECH': [
        TITULO,
        [...CABECALHO, 'Coluna Inventada Pelo Escritório'],
        [...linhaProcesso(1), 'algo'],
      ],
    })
    const r = lerPlanilha(buf)
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0].campos.valor_causa).toBe(1000)
    const p = r.pendencias.find(p => p.tipo === 'COLUNA_NAO_RECONHECIDA')
    expect(p!.campo).toBe('Coluna Inventada Pelo Escritório')
  })

  it('normaliza o Status com espaço à direita', () => {
    const r = lerPlanilha(planilha({ 'SEVEN INSURTECH': [TITULO, CABECALHO, linhaProcesso(1)] }))
    expect(r.linhas[0].campos.status).toBe('ATIVO')
  })

  it('ignora linha completamente vazia sem gerar pendência', () => {
    const buf = planilha({
      'SEVEN INSURTECH': [TITULO, CABECALHO, linhaProcesso(1), [], linhaProcesso(2)],
    })
    const r = lerPlanilha(buf)
    expect(r.linhas).toHaveLength(2)
    expect(r.pendencias.filter(p => p.tipo === 'LINHA_SEM_IDENTIFICADOR')).toHaveLength(0)
  })
})
