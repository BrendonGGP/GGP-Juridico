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
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
})
