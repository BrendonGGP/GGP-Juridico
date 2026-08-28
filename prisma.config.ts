// Prisma 7 não carrega .env automaticamente — este import é obrigatório.
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/**
 * Configuração do Prisma CLI (Prisma 7).
 *
 * Este arquivo governa apenas os comandos de CLI — migrate, introspect, studio.
 * Por isso o datasource aponta para DIRECT_URL: migração não funciona através do
 * transaction pooler (porta 6543), precisa da conexão direta (5432).
 *
 * O runtime da aplicação usa DATABASE_URL, declarada em prisma/schema.prisma.
 *
 * O `datasource` é declarado APENAS quando DIRECT_URL existe. Motivo: `env()`
 * é avaliado ao carregar a config e lança se a variável faltar — o que
 * quebrava `prisma generate` no CI, onde não há banco nem .env. O generate só
 * lê o schema para gerar tipos; exigir credencial dele obrigaria a dar acesso
 * ao banco a um ambiente que não precisa disso.
 *
 * Os comandos que REALMENTE tocam o banco continuam protegidos: sem
 * DIRECT_URL, `migrate` falha por falta de datasource, como deve.
 */
const temConexaoDireta = Boolean(process.env.DIRECT_URL)

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(temConexaoDireta ? { datasource: { url: env('DIRECT_URL') } } : {}),
})
