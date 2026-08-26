/**
 * Calibra a tabela de apelidos (REGRA 3) contra as planilhas reais.
 *
 * Lê APENAS ESTRUTURA: nomes de aba, linha de cabeçalho e contagem de linhas.
 * Nenhum conteúdo de célula é lido ou impresso — nada de nome de parte, placa,
 * apólice ou valor. Ver a classificação de dados no CLAUDE.md.
 *
 * Uso: node --experimental-strip-types scripts/analisar-cabecalhos.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import { resolverCabecalho } from '../lib/ingestao/mapeamento-colunas.ts'

const DIR = path.join(process.cwd(), 'dados-reais')

/** Pares dinâmicos da planilha de Acordos: DATA DE PAGAMENTO / VALOR DA PARCELA (mês/ano). */
const RE_COLUNA_MES =
  /^\s*(DATA DE PAGAMENTO|VALOR DA PARCELA)\s*\(?\s*([A-ZÇÃÕÁÉÍÓÚa-zçãõáéíóú]+)\s*\/\s*(\d{4})/i

function lerLinha(ws: XLSX.WorkSheet, r: number, range: XLSX.Range): string[] {
  const out: string[] = []
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cel = ws[XLSX.utils.encode_cell({ r, c })]
    out.push(cel ? String(cel.v ?? '').trim() : '')
  }
  return out
}

/**
 * Descobre em QUAL linha está o cabeçalho.
 *
 * As planilhas reais começam com uma faixa de título mesclada ("RELATÓRIO
 * ANALÍTICO DE TODOS OS PROCESSOS..."), então a linha 1 não é o cabeçalho.
 * Isso não está documentado na especificação — foi encontrado no arquivo real.
 *
 * Critério: entre as primeiras linhas, vence a que tem mais colunas resolvíveis
 * para campo lógico. É mais robusto que fixar "linha 2", porque o escritório
 * pode inserir ou remover linhas de topo entre um mês e outro.
 */
function detectarCabecalho(
  ws: XLSX.WorkSheet,
  range: XLSX.Range,
  maxLinhas = 10
): { linhaCabecalho: number; cabecalho: string[]; linhas: number } {
  let melhor = { linha: range.s.r, pontos: -1, valores: [] as string[] }

  const limite = Math.min(range.s.r + maxLinhas, range.e.r)
  for (let r = range.s.r; r <= limite; r++) {
    const valores = lerLinha(ws, r, range)
    const preenchidos = valores.filter(v => v !== '')
    if (!preenchidos.length) continue
    const pontos = resolverCabecalho(preenchidos).mapeadas.size
    if (pontos > melhor.pontos) melhor = { linha: r, pontos, valores }
  }

  return {
    linhaCabecalho: melhor.linha,
    cabecalho: melhor.valores,
    linhas: range.e.r - melhor.linha,
  }
}

function analisar(arquivo: string) {
  console.log('\n' + '='.repeat(78))
  console.log(arquivo)
  console.log('='.repeat(78))

  // Ler para Buffer e usar XLSX.read: é assim que o upload chegará em produção,
  // e o build ESM do SheetJS não acessa o disco por conta própria.
  const buf = fs.readFileSync(path.join(DIR, arquivo))
  const wb = XLSX.read(buf, {
    type: 'buffer',
    sheetStubs: false,
    cellDates: true,
    cellFormula: false, // não avaliar fórmulas de arquivo não confiável
    cellHTML: false,
  })

  console.log(`\nABAS (${wb.SheetNames.length}): ${wb.SheetNames.join(' | ')}`)

  const naoReconhecidasGlobais = new Set<string>()

  for (const nomeAba of wb.SheetNames) {
    const ws = wb.Sheets[nomeAba]
    const ref = ws['!ref']
    if (!ref) {
      console.log(`\n  [${nomeAba}]  aba vazia`)
      continue
    }
    const range = XLSX.utils.decode_range(ref)
    const { cabecalho, linhas, linhaCabecalho } = detectarCabecalho(ws, range)
    const preenchidos = cabecalho.filter(h => h !== '')

    const colunasMes = preenchidos.filter(h => RE_COLUNA_MES.test(h))
    const colunasNormais = preenchidos.filter(h => !RE_COLUNA_MES.test(h))

    const r = resolverCabecalho(colunasNormais)

    console.log(
      `\n  [${nomeAba}]  ${linhas} linhas de dados, ${preenchidos.length} colunas` +
        `  (cabecalho na linha ${linhaCabecalho + 1})`
    )
    console.log(
      `     reconhecidas: ${r.mapeadas.size}   nao reconhecidas: ${r.naoReconhecidas.length}` +
        (colunasMes.length ? `   colunas de mes: ${colunasMes.length}` : '')
    )

    if (r.naoReconhecidas.length) {
      for (const nr of r.naoReconhecidas) {
        console.log(`       ? ${JSON.stringify(nr.nome)}`)
        naoReconhecidasGlobais.add(nr.nome)
      }
    }
    if (r.duplicadas.length) {
      for (const d of r.duplicadas) {
        console.log(`       ! duplicada -> ${d.campo}: ${d.nomes.join(' / ')}`)
      }
    }
    if (colunasMes.length) {
      const meses = colunasMes
        .map(h => {
          const m = RE_COLUNA_MES.exec(h)
          return m ? `${m[2]}/${m[3]}`.toUpperCase() : '?'
        })
        .filter((v, i, a) => a.indexOf(v) === i)
      console.log(`       meses detectados: ${meses.join(', ')}`)
    }
  }

  return naoReconhecidasGlobais
}

function main() {
  const arquivos = fs
    .readdirSync(DIR)
    .filter(f => f.toLowerCase().endsWith('.xlsx'))
    .sort()

  if (!arquivos.length) {
    console.error('Nenhum .xlsx em dados-reais/')
    process.exit(1)
  }

  const todas = new Set<string>()
  for (const a of arquivos) for (const n of analisar(a)) todas.add(n)

  console.log('\n' + '='.repeat(78))
  console.log(`COLUNAS SEM MAPEAMENTO — ${todas.size} distintas`)
  console.log('='.repeat(78))
  for (const n of [...todas].sort()) console.log('  ' + JSON.stringify(n))
}

main()
