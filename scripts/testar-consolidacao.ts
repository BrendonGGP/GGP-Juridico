/**
 * Pipeline completo (ler + consolidar + mesclar) contra as planilhas REAIS.
 *
 * Usa `lib/ingestao/pipeline.ts`, o mesmo caminho da aplicação — um script de
 * conferência que refaz a sequência por conta própria confere a si mesmo.
 *
 * PRIVACIDADE: só contagens e identificadores truncados. Nenhuma linha exibida.
 *
 * Uso: node --experimental-strip-types scripts/testar-consolidacao.ts [AAAA-MM]
 */
import { carregar } from './_selecionar-arquivos.ts'
import { processarPlanilhas } from '../lib/ingestao/pipeline.ts'
import { brl, inteiro } from '../lib/formato.ts'

const MES = process.argv[2] ?? '2026-07'

const fGeral = carregar('GERAL', MES)
const fAcordos = carregar('ACORDOS', MES)
console.log('ARQUIVOS USADOS')
console.log(`  Geral:   ${fGeral.arquivo.nome}`)
console.log(`  Acordos: ${fAcordos.arquivo.nome}`)

const r = processarPlanilhas(fGeral.conteudo, fAcordos.conteudo)

console.log('\nLEITURA E CONSOLIDAÇÃO')
console.log(`  linhas lidas (Geral):    ${inteiro(r.totais.linhasGeral)}`)
console.log(`  registros do Geral:      ${inteiro(r.totais.registrosGeral)}`)
console.log(`  registros de Acordo:     ${inteiro(r.totais.registrosAcordo)}`)
console.log(`  registros finais:        ${inteiro(r.registros.length)}`)
console.log(`    ativos:                ${r.registros.filter(x => !x.encerrado).length}`)
console.log(`    encerrados:            ${r.registros.filter(x => x.encerrado).length}`)

console.log(`\nPENDÊNCIAS: ${r.pendencias.length}`)
const porTipo = new Map<string, number>()
for (const p of r.pendencias) porTipo.set(p.tipo, (porTipo.get(p.tipo) ?? 0) + 1)
for (const [tipo, n] of [...porTipo].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}x ${tipo}`)
}

console.log(`\nRECONCILIAÇÃO — numero_processo repetido: ${r.reconciliacao.length}`)
const porIdpj = r.reconciliacao.filter(x => x.explicadoPorIdpj).length
console.log(`  explicados por IDPJ (legítimo):  ${porIdpj}`)
console.log(`  exigem revisão humana:           ${r.reconciliacao.length - porIdpj}`)

console.log(`\nACORDOS ÓRFÃOS: ${r.orfaos.length}`)
for (const o of r.orfaos) {
  console.log(`  ficha ${o.ficha ?? '(sem)'} — linha ${o.origem.linha}`)
}

const comParcelas = r.registros.filter(x => x.parcelas.length > 0)
const totalParcelas = r.registros.reduce((s, x) => s + x.parcelas.length, 0)
console.log('\nPARCELAS')
console.log(`  meses detectados:        ${r.mesesDetectados.join(', ') || '(nenhum)'}`)
console.log(`  processos com parcela:   ${comParcelas.length}`)
console.log(`  total de parcelas:       ${totalParcelas}`)

// Conferência de ordem de grandeza, sem detalhar por processo.
const soma = r.registros.reduce((s, x) => s + x.parcelas.reduce((a, p) => a + p.valor, 0), 0)
console.log(`  soma das parcelas:       ${brl(soma)}`)
