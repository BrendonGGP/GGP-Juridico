/**
 * Pipeline completo (ler + consolidar) contra as planilhas REAIS.
 *
 * PRIVACIDADE: só contagens e identificadores truncados. Nenhuma linha exibida.
 *
 * Uso: node --experimental-strip-types scripts/testar-consolidacao.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { lerPlanilha } from '../lib/ingestao/ler-planilha.ts'
import { consolidar, mesclarAcordos } from '../lib/ingestao/consolidar.ts'

const DIR = path.join(process.cwd(), 'dados-reais')
const arquivos = fs.readdirSync(DIR).filter(f => f.endsWith('.xlsx'))

const geralJulho = arquivos.find(f => f.includes('JULHO'))!
const acordos = arquivos.find(f => f.toUpperCase().includes('ACORDOS'))!

console.log('RELATÓRIO GERAL —', geralJulho)
const lidoGeral = lerPlanilha(fs.readFileSync(path.join(DIR, geralJulho)))
const consGeral = consolidar(lidoGeral.linhas)

console.log(`  linhas lidas:        ${lidoGeral.linhas.length}`)
console.log(`  registros únicos:    ${consGeral.registros.length}`)
console.log(`    ativos:            ${consGeral.registros.filter(r => !r.encerrado).length}`)
console.log(`    encerrados:        ${consGeral.registros.filter(r => r.encerrado).length}`)
console.log(`  pendências:          ${consGeral.pendencias.length}`)

const porTipo = new Map<string, number>()
for (const p of consGeral.pendencias) porTipo.set(p.tipo, (porTipo.get(p.tipo) ?? 0) + 1)
for (const [t, n] of porTipo) console.log(`    ${String(n).padStart(4)}x ${t}`)

console.log(`\n  RECONCILIAÇÃO — numero_processo repetido: ${consGeral.reconciliacao.length}`)
const idpj = consGeral.reconciliacao.filter(r => r.explicadoPorIdpj).length
console.log(`    explicados por IDPJ (legítimo):  ${idpj}`)
console.log(`    exigem revisão humana:           ${consGeral.reconciliacao.length - idpj}`)

console.log('\nACORDOS —', acordos)
const lidoAcordos = lerPlanilha(fs.readFileSync(path.join(DIR, acordos)))
const consAcordos = consolidar(lidoAcordos.linhas)
console.log(`  registros:           ${consAcordos.registros.length}`)
const comParcela = consAcordos.registros.filter(r => r.parcelas.length > 0)
console.log(`  com parcelas:        ${comParcela.length}`)
console.log(
  `  total de parcelas:   ${consAcordos.registros.reduce((s, r) => s + r.parcelas.length, 0)}`
)
console.log(`  meses detectados:    ${lidoAcordos.mesesDetectados.join(', ')}`)

console.log('\nMESCLAGEM')
const { registros, orfaos } = mesclarAcordos(consGeral.registros, consAcordos.registros)
console.log(`  registros finais:    ${registros.length}`)
console.log(`  acordos casados:     ${consAcordos.registros.length - orfaos.length}`)
console.log(`  ACORDOS ÓRFÃOS:      ${orfaos.length}`)
for (const o of orfaos) {
  console.log(`     ficha ${o.ficha ?? '(sem)'} — linha ${o.origem.linha}`)
}

const comParcelasFinal = registros.filter(r => r.parcelas.length > 0)
console.log(`\n  processos com parcela após mesclagem: ${comParcelasFinal.length}`)
const totalParcelas = registros.reduce((s, r) => s + r.parcelas.length, 0)
console.log(`  total de parcelas gravaveis:          ${totalParcelas}`)

// A soma é apenas conferência de ordem de grandeza, sem detalhar por processo.
const soma = registros.reduce((s, r) => s + r.parcelas.reduce((a, p) => a + p.valor, 0), 0)
console.log(`  soma das parcelas (conferência):      R$ ${soma.toLocaleString('pt-BR')}`)
