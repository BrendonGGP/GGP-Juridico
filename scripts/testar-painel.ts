/**
 * Verifica a camada de dados do painel (lib/painel/carregar.ts).
 *
 * Por que existe: `carregarPainel` faz a conversão Decimal → number ao ler o
 * banco. Um erro ali (um Decimal virando NaN, um null virando 0) não aparece
 * em typecheck, não aparece em teste unitário com objeto literal, e produziria
 * um total de provisionamento errado com cara de certo.
 *
 * O que é verificado aqui, sem gravar nada:
 *
 *   1. `gravarImportacao` em dryRun — prova que os registros consolidados
 *      ATRAVESSAM o schema do banco (tipos, tamanhos, constraints). É o mesmo
 *      caminho de escrita da importação real, apenas desfeito ao final.
 *   2. `carregarPainel` contra o estado atual do banco — prova que a leitura e
 *      a conversão numérica funcionam, ou informa que ainda não há importação
 *      concluída para ler.
 *
 * A gravação definitiva é operação L3 e exige aprovação humana explícita;
 * este script nunca a executa.
 *
 * PRIVACIDADE: apenas agregados e contagens. Nenhum processo é identificado.
 *
 * Uso: node --experimental-strip-types scripts/testar-painel.ts
 */
// Prisma 7 não carrega .env sozinho — tem de vir antes de lib/db.ts.
import 'dotenv/config'
import { carregar } from './_selecionar-arquivos.ts'
import { lerPlanilha } from '../lib/ingestao/ler-planilha.ts'
import { consolidar, mesclarAcordos } from '../lib/ingestao/consolidar.ts'
import { gravarImportacao } from '../lib/ingestao/gravar.ts'
import { carregarPainel, mesesDisponiveis } from '../lib/painel/carregar.ts'
import { prisma } from '../lib/db.ts'
import { CENARIOS, ROTULO_CENARIO } from '../lib/calculo/cenarios.ts'

const MES = process.argv[2] ?? '2026-07'
const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

let falhas = 0
const falhar = (msg: string) => {
  console.error(`  FALHOU: ${msg}`)
  falhas++
}

// ---------------------------------------------------------------------------
// 1. O consolidado atravessa o schema? (dryRun: grava e desfaz)
// ---------------------------------------------------------------------------
const fGeral = carregar('GERAL', MES)
const fAcordos = carregar('ACORDOS', MES)
console.log(`Geral:   ${fGeral.arquivo.nome}`)
console.log(`Acordos: ${fAcordos.arquivo.nome}\n`)

const lidoGeral = lerPlanilha(fGeral.conteudo)
const consGeral = consolidar(lidoGeral.linhas)
const lidoAcordos = lerPlanilha(fAcordos.conteudo)
const consAcordos = consolidar(lidoAcordos.linhas)
const { registros, orfaos } = mesclarAcordos(consGeral.registros, consAcordos.registros)

console.log(`ESCRITA (dryRun) — ${registros.length} processos consolidados`)

const r = await gravarImportacao(prisma, {
  mesReferencia: MES,
  // Chave própria de verificação: nunca colide com uma importação real.
  idempotencyKey: `verificacao-painel-${MES}`,
  registros,
  pendencias: [...lidoGeral.pendencias, ...consGeral.pendencias],
  reconciliacao: consGeral.reconciliacao,
  orfaos,
  arquivoGeralNome: fGeral.arquivo.nome,
  arquivoAcordosNome: fAcordos.arquivo.nome,
  dryRun: true,
})

if (!r.dryRun) falhar('gravarImportacao não reportou dryRun')
console.log(`  processos novos:      ${r.processosNovos}`)
console.log(`  snapshots gravados:   ${r.snapshotsGravados}`)
console.log(`  parcelas inseridas:   ${r.parcelasInseridas}`)

if (r.snapshotsGravados !== registros.length) {
  falhar(`snapshots ${r.snapshotsGravados} ≠ consolidados ${registros.length}`)
}

// O dryRun tem que ter desfeito tudo.
const residuo = await prisma.importacao.count({
  where: { idempotencyKey: `verificacao-painel-${MES}` },
})
if (residuo === 0) console.log('  rollback confirmado: nada ficou no banco.')
else falhar(`${residuo} importação(ões) de verificação ficaram gravadas`)

// ---------------------------------------------------------------------------
// 2. A leitura do painel funciona sobre o que existe no banco?
// ---------------------------------------------------------------------------
console.log('\nLEITURA (banco real)')
const meses = await mesesDisponiveis()

if (meses.length === 0) {
  console.log('  Nenhuma importação concluída no banco.')
  console.log('  A tela mostra o estado "sem dados", que é o correto —')
  console.log('  a conversão Decimal→number só pode ser provada após a')
  console.log('  primeira importação real (operação L3, exige aprovação).')
} else {
  console.log(`  meses disponíveis: ${meses.join(', ')}`)
  const painel = await carregarPainel()
  if (!painel) {
    falhar('há meses disponíveis mas carregarPainel devolveu null')
  } else {
    console.log(`  base: ${painel.totalProcessos} processos (${painel.importacao.mesReferencia})`)

    console.log('\n  PROVISIONAMENTO')
    for (const c of CENARIOS) {
      const v = painel.cenarios[c].totalProvisionado
      if (!Number.isFinite(v)) falhar(`cenário ${c} devolveu valor não finito: ${v}`)
      console.log(`    ${ROTULO_CENARIO[c].padEnd(13)} ${brl(v).padStart(18)}`)
    }

    console.log('\n  INDICADORES')
    console.log(`    Projeção 12m:  ${brl(painel.projecao.horizontes[12].total)}`)
    console.log(
      `    Taxa de êxito: ${painel.exito.percentual.valor?.toFixed(1) ?? '—'}%` +
        ` (base ${painel.exito.percentual.base})`
    )
    console.log(`    Top por valor: ${painel.top.topPorValor.length}`)
    console.log(`    Trab. + IDPJ:  ${painel.top.trabalhistaEIdpj.length}`)

    // O erro que este script existe para pegar.
    const naoFinitos = painel.top.topPorValor.filter(p => !Number.isFinite(p.valorRanqueamento))
    if (naoFinitos.length) {
      falhar(`${naoFinitos.length} processo(s) com valor não finito após Decimal→number`)
    } else {
      console.log('\n  Nenhum NaN na conversão Decimal → number.')
    }
  }
}

await prisma.$disconnect()
console.log(falhas === 0 ? '\nOK' : `\n${falhas} verificação(ões) falharam`)
process.exit(falhas === 0 ? 0 : 1)
