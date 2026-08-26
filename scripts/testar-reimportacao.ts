/**
 * Prova COMPORTAMENTAL de que o reenvio mensal não corrompe os dados.
 *
 * Este é o risco central do projeto: toda planilha é reenviada, e a de agosto
 * repete os meses que a de julho já trouxe. Se a parcela de julho for inserida
 * de novo em vez de atualizada, a Projeção de Desembolso infla em silêncio —
 * ninguém percebe até o número estar errado por meses.
 *
 * DADOS SINTÉTICOS de propósito. As planilhas reais ficam restritas à máquina
 * local (CLAUDE.md), e o banco é nuvem. O que está sob teste é o mecanismo.
 *
 * Limpa tudo o que criou ao final.
 *
 * Uso: node --experimental-strip-types scripts/testar-reimportacao.ts
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { gravarImportacao } from '../lib/ingestao/gravar.ts'
import type { RegistroConsolidado } from '../lib/ingestao/consolidar.ts'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const PREFIXO = 'TESTE-REIMP-'

function registro(
  n: number,
  parcelas: { mesReferencia: string; valor: number }[]
): RegistroConsolidado {
  return {
    chaveIdentidade: `${PREFIXO}ficha:f${n}`,
    numeroProcesso: `${PREFIXO}000${n}`,
    ficha: `${PREFIXO}F${n}`,
    carteira: `${PREFIXO}Carteira Fictícia`,
    encerrado: false,
    campos: { risco: 'PROVAVEL', valor_causa: 10_000, valor_provisionado: 5_000 },
    parcelas: parcelas.map(p => ({ ...p, dataPagamento: null })),
    origem: { aba: 'ABA FICTICIA', linha: 3 },
    pendencias: [],
  }
}

async function contar() {
  const [processos, snapshots, parcelas, importacoes] = await Promise.all([
    prisma.processo.count({ where: { chaveIdentidade: { startsWith: PREFIXO } } }),
    prisma.processoSnapshot.count({
      where: { processo: { chaveIdentidade: { startsWith: PREFIXO } } },
    }),
    prisma.parcelaAcordo.count({
      where: { processo: { chaveIdentidade: { startsWith: PREFIXO } } },
    }),
    prisma.importacao.count({ where: { idempotencyKey: { startsWith: PREFIXO } } }),
  ])
  const soma = await prisma.parcelaAcordo.aggregate({
    where: { processo: { chaveIdentidade: { startsWith: PREFIXO } } },
    _sum: { valorParcela: true },
  })
  return {
    processos,
    snapshots,
    parcelas,
    importacoes,
    somaParcelas: Number(soma._sum.valorParcela ?? 0),
  }
}

async function limpar() {
  await prisma.parcelaAcordo.deleteMany({
    where: { processo: { chaveIdentidade: { startsWith: PREFIXO } } },
  })
  await prisma.processoSnapshot.deleteMany({
    where: { processo: { chaveIdentidade: { startsWith: PREFIXO } } },
  })
  await prisma.logValidacao.deleteMany({
    where: { importacao: { idempotencyKey: { startsWith: PREFIXO } } },
  })
  await prisma.processo.deleteMany({ where: { chaveIdentidade: { startsWith: PREFIXO } } })
  await prisma.importacao.deleteMany({ where: { idempotencyKey: { startsWith: PREFIXO } } })
  await prisma.cliente.deleteMany({ where: { nome: { startsWith: PREFIXO } } })
}

function checar(rotulo: string, obtido: unknown, esperado: unknown): boolean {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  console.log(`  ${ok ? 'OK  ' : 'FALHOU'}  ${rotulo}: ${obtido}${ok ? '' : ` (esperado ${esperado})`}`)
  return ok
}

async function main() {
  await limpar()
  let tudoOk = true

  // ------------------------------------------------------------------
  console.log('\n1) JULHO — primeira importação')
  // Planilha de julho: parcelas de julho e agosto.
  const julho = await gravarImportacao(prisma, {
    mesReferencia: '2026-07',
    idempotencyKey: `${PREFIXO}julho`,
    registros: [
      registro(1, [
        { mesReferencia: '2026-07', valor: 500 },
        { mesReferencia: '2026-08', valor: 500 },
      ]),
      registro(2, [{ mesReferencia: '2026-07', valor: 300 }]),
    ],
    pendencias: [],
    reconciliacao: [],
    orfaos: [],
  })
  console.log(
    `  processos novos ${julho.processosNovos}, parcelas inseridas ${julho.parcelasInseridas}`
  )
  let c = await contar()
  tudoOk = checar('processos', c.processos, 2) && tudoOk
  tudoOk = checar('parcelas', c.parcelas, 3) && tudoOk
  tudoOk = checar('soma das parcelas', c.somaParcelas, 1300) && tudoOk

  // ------------------------------------------------------------------
  console.log('\n2) AGOSTO — reenvio com os MESMOS meses + um novo')
  const agosto = await gravarImportacao(prisma, {
    mesReferencia: '2026-08',
    idempotencyKey: `${PREFIXO}agosto`,
    registros: [
      registro(1, [
        { mesReferencia: '2026-07', valor: 500 }, // repetida
        { mesReferencia: '2026-08', valor: 500 }, // repetida
        { mesReferencia: '2026-09', valor: 500 }, // nova
      ]),
      registro(2, [{ mesReferencia: '2026-07', valor: 300 }]), // repetida
    ],
    pendencias: [],
    reconciliacao: [],
    orfaos: [],
  })
  console.log(
    `  processos novos ${agosto.processosNovos}, atualizados ${agosto.processosAtualizados}`
  )
  console.log(
    `  parcelas inseridas ${agosto.parcelasInseridas}, atualizadas ${agosto.parcelasAtualizadas}`
  )

  c = await contar()
  console.log('\n  --- O QUE IMPORTA ---')
  // Os mesmos 2 processos, não 4: o histórico continua ligado (REGRA 5).
  tudoOk = checar('processos continuam 2 (não duplicaram)', c.processos, 2) && tudoOk
  // 4 parcelas: as 3 de julho + a nova de setembro. NÃO 7.
  tudoOk = checar('parcelas são 4 (não 7)', c.parcelas, 4) && tudoOk
  tudoOk = checar('soma é 1800 (não 3100)', c.somaParcelas, 1800) && tudoOk
  // REGRA 6: o histórico dobrou — 2 snapshots por processo.
  tudoOk = checar('snapshots dobraram (histórico preservado)', c.snapshots, 4) && tudoOk
  tudoOk = checar('importações', c.importacoes, 2) && tudoOk

  // ------------------------------------------------------------------
  console.log('\n3) VALOR CORRIGIDO no reenvio — substitui, não soma')
  await gravarImportacao(prisma, {
    mesReferencia: '2026-09',
    idempotencyKey: `${PREFIXO}setembro`,
    registros: [registro(2, [{ mesReferencia: '2026-07', valor: 999 }])],
    pendencias: [],
    reconciliacao: [],
    orfaos: [],
  })
  const p2 = await prisma.parcelaAcordo.findFirst({
    where: {
      processo: { chaveIdentidade: `${PREFIXO}ficha:f2` },
      mesReferencia: '2026-07',
    },
  })
  tudoOk = checar('valor substituído', Number(p2?.valorParcela ?? 0), 999) && tudoOk

  // ------------------------------------------------------------------
  console.log('\n4) IDEMPOTÊNCIA — o MESMO arquivo reenviado')
  const antes = await contar()
  const repetida = await gravarImportacao(prisma, {
    mesReferencia: '2026-07',
    idempotencyKey: `${PREFIXO}julho`, // mesma chave
    registros: [registro(1, [{ mesReferencia: '2026-07', valor: 500 }])],
    pendencias: [],
    reconciliacao: [],
    orfaos: [],
  })
  const depois = await contar()
  tudoOk = checar('detectado como já importado', repetida.jaImportado, true) && tudoOk
  tudoOk = checar('nada foi gravado', depois.snapshots, antes.snapshots) && tudoOk

  // ------------------------------------------------------------------
  console.log('\n5) DRY-RUN — não deixa rastro')
  const antesDry = await contar()
  const dry = await gravarImportacao(prisma, {
    mesReferencia: '2026-10',
    idempotencyKey: `${PREFIXO}dryrun`,
    registros: [registro(3, [{ mesReferencia: '2026-10', valor: 777 }])],
    pendencias: [],
    reconciliacao: [],
    orfaos: [],
    dryRun: true,
  })
  const depoisDry = await contar()
  console.log(
    `  preview diz: ${dry.processosNovos} novos, ${dry.parcelasInseridas} parcelas`
  )
  tudoOk = checar('processos inalterados', depoisDry.processos, antesDry.processos) && tudoOk
  tudoOk = checar('parcelas inalteradas', depoisDry.parcelas, antesDry.parcelas) && tudoOk
  tudoOk = checar('importações inalteradas', depoisDry.importacoes, antesDry.importacoes) && tudoOk

  await limpar()
  console.log('\n' + (tudoOk ? 'TODAS AS VERIFICAÇÕES PASSARAM' : 'HOUVE FALHA — ver acima'))
  await prisma.$disconnect()
  process.exit(tudoOk ? 0 : 1)
}

main().catch(async e => {
  console.error('ERRO:', e.message)
  await limpar().catch(() => {})
  await prisma.$disconnect()
  process.exit(1)
})
