import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { exigir } from '../config.ts'

/**
 * Clientes do Supabase Auth para o SERVIDOR.
 *
 * O cliente de navegador vive em `cliente-navegador.ts`, separado por
 * necessidade técnica: `next/headers` no topo deste módulo contamina todo
 * mundo que o importa, e o build falha ao ver essa API de servidor alcançável
 * do bundle do cliente.
 *
 * `server-only` no topo transforma um import indevido em erro de build com
 * mensagem clara, em vez do rastro difuso que essa confusão produziu antes.
 *
 * São dois contextos aqui, e trocá-los é erro de segurança, não de estilo:
 *
 *   servidor  — Server Components e rotas de API. Lê e escreve o cookie de
 *               sessão com a chave anônima, sujeita às políticas do banco.
 *   servico   — ignora TODA política de acesso. Só para operações
 *               administrativas deliberadas, como convidar um usuário.
 *
 * Por que a chave de serviço é perigosa: com ela, uma consulta lê e escreve
 * qualquer linha de qualquer tabela, sem checagem. Um único uso descuidado
 * num componente de tela exporia a base inteira.
 */

/**
 * Cliente para Server Components e rotas de API.
 *
 * O Next 16 exige `await cookies()`. A escrita é envolvida em try/catch porque
 * Server Components não podem alterar cookies — nesse caso o middleware já
 * cuidou da renovação da sessão, e falhar aqui derrubaria a página por um
 * efeito colateral que não era necessário.
 */
export async function clienteServidor() {
  const jar = await cookies()

  return createServerClient(
    exigir('NEXT_PUBLIC_SUPABASE_URL'),
    exigir('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: cookiesParaGravar => {
          try {
            cookiesParaGravar.forEach(({ name, value, options }) =>
              jar.set(name, value, options)
            )
          } catch {
            // Server Component: o middleware renova a sessão. Ignorar é seguro.
          }
        },
      },
    }
  )
}

/**
 * Cliente administrativo — IGNORA as políticas de acesso do banco.
 *
 * Uso restrito a operações que o administrador dispara conscientemente, como
 * convidar um usuário. Toda chamada deve estar precedida de uma checagem de
 * perfil no código que a invoca; este cliente não checa nada por conta própria.
 *
 * Não guarda sessão nem renova token: é uma chave de máquina, não de pessoa.
 */
export function clienteServico() {
  return createServerClient(
    exigir('NEXT_PUBLIC_SUPABASE_URL'),
    exigir('SUPABASE_SERVICE_ROLE_KEY'),
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}
