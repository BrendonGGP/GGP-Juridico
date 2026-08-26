/**
 * Roda o leitor completo contra as planilhas REAIS.
 *
 * PRIVACIDADE: imprime apenas contagens e as mensagens de pendência (que já
 * truncam o conteúdo). Nenhuma linha é exibida.
 *
 * Uso: node --experimental-strip-types scripts/testar-leitura.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { lerPlanilha } from '../lib/ingestao/ler-planilha.ts'

const DIR = path.join(process.cwd(), 'dados-reais')

for (const arquivo of fs.readdirSync(DIR).filter(f => f.endsWith('.xlsx')).sort()) {
  console.log('\n' + '='.repeat(74))
  console.log(arquivo)
  console.log('='.repeat(74))

  const r = lerPlanilha(fs.readFileSync(path.join(DIR, arquivo)))

  console.log('\nABAS:')
  for (const a of r.abasLidas) {
    console.log(`  ${a.tipo.padEnd(10)} ${String(a.linhas).padStart(4)} linhas  ${a.nome}`)
  }

  const ativas = r.linhas.filter(l => !l.encerrado).length
  const encerradas = r.linhas.filter(l => l.encerrado).length
  console.log(`\nREGISTROS PRODUZIDOS: ${r.linhas.length}`)
  console.log(`  ativos:    ${ativas}`)
  console.log(`  encerrados: ${encerradas}  (vieram de BAIXADOS)`)

  if (r.mesesDetectados.length) {
    console.log(`\nMESES DE PARCELA: ${r.mesesDetectados.join(', ')}`)
  }

  const pendLinha = r.linhas.reduce((s, l) => s + l.pendencias.length, 0)
  const linhasComPendencia = r.linhas.filter(l => l.pendencias.length > 0).length
  console.log(`\nPENDÊNCIAS`)
  console.log(`  de arquivo/aba: ${r.pendencias.length}`)
  console.log(`  de linha:       ${pendLinha}  (em ${linhasComPendencia} linhas)`)
  console.log(
    `  linhas aproveitadas mesmo com pendência: ${linhasComPendencia} ` +
      '(REGRA 10 — nenhuma trava o lote)'
  )

  for (const p of r.pendencias) {
    console.log(`\n  [${p.tipo}] ${p.aba}${p.linha ? ` linha ${p.linha}` : ''}`)
    console.log(`     ${p.detalhe.slice(0, 150)}`)
  }

  // Amostra dos tipos de pendência de linha, sem repetir.
  const tipos = new Map<string, number>()
  for (const l of r.linhas) {
    for (const p of l.pendencias) {
      const k = `${p.campo}: ${p.detalhe.split(':')[0]}`
      tipos.set(k, (tipos.get(k) ?? 0) + 1)
    }
  }
  if (tipos.size) {
    console.log('\n  pendências de linha por tipo:')
    for (const [k, n] of [...tipos.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${String(n).padStart(4)}x ${k}`)
    }
  }
}
