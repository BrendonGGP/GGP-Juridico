import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente Supabase para código que roda no NAVEGADOR.
 *
 * Vive separado dos clientes de servidor por necessidade técnica, não por
 * organização: um `import { cookies } from 'next/headers'` no topo de um
 * módulo contamina todo mundo que o importa, e o build falha ao ver essa API
 * de servidor alcançável a partir do bundle do cliente.
 *
 * Usa a chave anônima, que é pública por natureza — vai para o navegador e é
 * protegida pelas políticas de acesso do banco, não por sigilo.
 *
 * Lê `process.env` direto em vez de passar por lib/config.ts: só variáveis com
 * prefixo NEXT_PUBLIC_ são substituídas no bundle do cliente, e importar a
 * config traria o schema inteiro (com nomes de segredos de servidor) junto.
 */
export function clienteNavegador() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !chave) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausente. Confira o .env.'
    )
  }

  return createBrowserClient(url, chave)
}
