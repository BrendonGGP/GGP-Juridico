import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Cliente Prisma para o runtime da aplicação.
 *
 * Prisma 7 exige um driver adapter — a URL não vem mais do schema.prisma.
 * Usa DATABASE_URL (pooler, porta 6543). As migrações usam DIRECT_URL e são
 * configuradas à parte, em prisma.config.ts.
 *
 * O singleton evita esgotar o pool durante o hot-reload do Next em dev.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function criar(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL ausente')
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

export const prisma = globalForPrisma.prisma ?? criar()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
