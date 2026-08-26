/**
 * Roda os normalizadores contra as planilhas REAIS e conta pendências.
 *
 * Teste unitário prova que o parser trata os casos que EU imaginei. Este script
 * prova o que acontece com os dados que existem de verdade.
 *
 * PRIVACIDADE: imprime apenas contagens e motivos com o conteúdo truncado e
 * mascarado pelos próprios normalizadores. Nenhuma linha é exibida inteira.
 *
 * Uso: node --experimental-strip-types scripts/testar-normalizadores.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import { resolverCabecalho, type CampoLogico } from '../lib/ingestao/mapeamento-colunas.ts'
import {
  parseData,
  parseNumero,
  parseRisco,
  parseSimNao,
  parseExito,
  parseTexto,
} from '../lib/ingestao/normalizar.ts'

const DIR = path.join(process.cwd(), 'dados-reais')

type Parser = (v: unknown) => { valor: unknown; motivo?: string }

const PARSERS: Partial<Record<CampoLogico, Parser>> = {
  data_cadastro: parseData,
  data_ajuizamento: parseData,
  data_citacao: parseData,
  data_encerramento: parseData,
  data_condenacao: parseData,
  data_sinistro: parseData,
  valor_causa: parseNumero,
  valor_acordo: parseNumero,
  valor_condenacao: parseNumero,
  valor_provisionado: parseNumero,
  risco: parseRisco,
  mga_polo_passivo: parseSimNao,
  exito_processo: parseExito,
  status: parseTexto,
}

const pendencias = new Map<string, { n: number; exemplo: string }>()
let celulas = 0
let comValor = 0

function processar(arquivo: string) {
  const wb = XLSX.read(fs.readFileSync(path.join(DIR, arquivo)), {
    type: 'buffer',
    cellDates: true,
    cellFormula: false,
  })

  let linhasTotal = 0

  for (const aba of wb.SheetNames) {
    if (aba === 'GERAL') continue // REGRA 9: não é importada
    const ws = wb.Sheets[aba]
    if (!ws['!ref']) continue
    const range = XLSX.utils.decode_range(ws['!ref'])
    const linhaCab = range.s.r + 1

    const nomes: string[] = []
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cel = ws[XLSX.utils.encode_cell({ r: linhaCab, c })]
      nomes.push(cel ? String(cel.v ?? '').trim() : '')
    }
    const { mapeadas } = resolverCabecalho(nomes)
    linhasTotal += range.e.r - linhaCab

    for (let r = linhaCab + 1; r <= range.e.r; r++) {
      for (const [campo, idx] of mapeadas) {
        const parser = PARSERS[campo]
        if (!parser) continue
        const cel = ws[XLSX.utils.encode_cell({ r, c: range.s.c + idx })]
        celulas++
        const res = parser(cel ? cel.v : undefined)

        // parseExito devolve o motivo dentro do objeto.
        const motivo =
          res.motivo ??
          (res.valor && typeof res.valor === 'object' && 'motivo' in res.valor
            ? (res.valor as { motivo?: string }).motivo
            : undefined)

        if (motivo) {
          const chave = `${campo}: ${motivo.split(':')[0]}`
          const p = pendencias.get(chave) ?? { n: 0, exemplo: motivo }
          p.n++
          pendencias.set(chave, p)
        } else if (res.valor !== null) {
          comValor++
        }
      }
    }
  }

  console.log(`  ${arquivo}`)
  console.log(`    ${linhasTotal} linhas de dados`)
}

const arquivos = fs.readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.xlsx')).sort()
console.log('ARQUIVOS PROCESSADOS:')
for (const a of arquivos) processar(a)

console.log(`\nCÉLULAS AVALIADAS: ${celulas}`)
console.log(`  com valor:  ${comValor}`)
console.log(`  ausentes:   ${celulas - comValor - [...pendencias.values()].reduce((s, p) => s + p.n, 0)}`)
console.log(`  pendências: ${[...pendencias.values()].reduce((s, p) => s + p.n, 0)}`)

console.log(`\nPENDÊNCIAS POR TIPO (${pendencias.size} tipos distintos):`)
if (pendencias.size === 0) {
  console.log('  nenhuma')
} else {
  for (const [chave, p] of [...pendencias.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${String(p.n).padStart(5)}x  ${chave}`)
    console.log(`          ex.: ${p.exemplo.slice(0, 110)}`)
  }
}
