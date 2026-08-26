/**
 * Verifica que as regras de domínio existem como restrição REAL no banco,
 * não apenas como comentário no schema.
 *
 * A verificação da REGRA 4 é COMPORTAMENTAL: tenta de fato gravar uma parcela
 * duplicada e exige que o banco recuse. Ler catálogo do sistema é prova fraca —
 * um índice pode existir e mesmo assim não cobrir o caso que importa.
 *
 * Tudo roda dentro de uma transação que sofre ROLLBACK. Nada é persistido.
 *
 * Uso: node --experimental-strip-types scripts/verificar-banco.ts
 */
import 'dotenv/config'
import { Client } from 'pg'

const SQL_TABELAS = `
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name;
`

/// Prisma cria @@unique como índice único, que NÃO aparece em
/// information_schema.table_constraints. É preciso olhar pg_indexes.
const SQL_INDICES_UNICOS = `
  SELECT tablename, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public' AND indexdef ILIKE '%UNIQUE%'
  ORDER BY tablename;
`

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) throw new Error('DIRECT_URL ausente no .env')

  const client = new Client({ connectionString: url })
  await client.connect()

  const tabelas = await client.query<{ table_name: string }>(SQL_TABELAS)
  console.log(`\nTABELAS (${tabelas.rowCount}):`)
  for (const r of tabelas.rows) console.log('  -', r.table_name)

  const idx = await client.query<{ tablename: string; indexdef: string }>(
    SQL_INDICES_UNICOS
  )
  console.log(`\nÍNDICES ÚNICOS (${idx.rowCount}):`)
  for (const r of idx.rows) {
    const cols = r.indexdef.slice(r.indexdef.indexOf('('))
    console.log(`  - ${r.tablename} ${cols}`)
  }

  await testarRegra4(client)

  await client.end()
}

/**
 * REGRA 4 — chave composta (processo + mês de referência).
 * Sem ela, cada reenvio mensal duplica parcelas e infla a projeção de desembolso.
 */
async function testarRegra4(client: Client) {
  console.log('\n--- REGRA 4: banco recusa parcela duplicada? ---')
  await client.query('BEGIN')
  try {
    await client.query(
      `INSERT INTO processo (id, "numeroProcesso", "criadoEm")
       VALUES ('teste-regra4', '0000000-00.2026.8.13.0000', now())`
    )
    const parcela = `
      INSERT INTO parcela_acordo
        (id, "processoId", "mesReferencia", "valorParcela", "importacaoId", "atualizadoEm")
      VALUES ($1, 'teste-regra4', '2026-07', 1000.00, 'imp-teste', now())
    `
    await client.query(
      `INSERT INTO importacao (id, "mesReferencia", "idempotencyKey", "iniciadaEm")
       VALUES ('imp-teste', '2026-07', 'chave-teste', now())`
    )
    await client.query(parcela, ['p1'])
    console.log('  1a parcela gravada.')

    let recusou = false
    try {
      await client.query(parcela, ['p2']) // mesmo processo + mesmo mês
    } catch (e) {
      recusou = (e as { code?: string }).code === '23505' // unique_violation
      console.log(`  2a parcela RECUSADA pelo banco (SQLSTATE ${(e as { code?: string }).code}).`)
    }

    await client.query('ROLLBACK')

    if (recusou) {
      console.log('  OK — a duplicação é impossível no nível do banco.')
    } else {
      console.error('  FALHOU — o banco aceitou parcela duplicada.')
      process.exit(1)
    }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  }
}

main().catch(e => {
  console.error('ERRO:', e.message)
  process.exit(1)
})
