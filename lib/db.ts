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
 *
 * A criação é PREGUIÇOSA, e isso não é detalhe de estilo: o `next build`
 * importa as páginas para analisá-las, sem executar consulta nenhuma. Criando
 * o cliente no import, o build passava a exigir DATABASE_URL — e exigir
 * credencial de banco para compilar significaria dar acesso ao banco ao CI,
 * que não precisa e não deve ter.
 *
 * A verificação da variável continua existindo; ela apenas acontece na
 * primeira consulta de verdade, e não ao carregar o módulo.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function criar(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL ausente')

  const cliente = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = cliente
  return cliente
}

/**
 * Proxy que instancia o cliente no primeiro acesso a uma propriedade.
 *
 * Mantém a API idêntica — `prisma.processo.findMany()` continua igual — sem
 * exigir que cada chamador saiba que há inicialização preguiçosa por baixo.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_alvo, prop, receptor) {
    const cliente = globalForPrisma.prisma ?? criar()
    const valor = Reflect.get(cliente, prop, receptor)
    // Métodos precisam do `this` do cliente real, não do proxy.
    return typeof valor === 'function' ? valor.bind(cliente) : valor
  },
})
