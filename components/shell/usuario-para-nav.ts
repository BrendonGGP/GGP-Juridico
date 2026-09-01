import 'server-only'
import { usuarioAtual, podeImportar, ROTULO_PERFIL } from '@/lib/auth/sessao'
import { authConfigurada } from '@/lib/config'
import type { UsuarioVisivel } from './tipos'

/**
 * Traduz o usuário da sessão no mínimo que a navegação precisa exibir.
 *
 * Existe como módulo separado por uma razão de bundling, descoberta na
 * prática: `Pagina.tsx` renderiza a `Sidebar`, que é Client Component. Isso
 * faz o Turbopack tratar o grafo de imports de `Pagina` como alcançável pelo
 * cliente — e importar `lib/auth/sessao` ali arrastava `next/headers`, Prisma
 * e `pg` para o bundle do navegador, quebrando o build.
 *
 * Chamando daqui, a fronteira fica explícita: este arquivo é `server-only` e
 * `Pagina` recebe o resultado já pronto.
 *
 * Repare no que atravessa: nome, rótulo do perfil e um booleano. O id e o
 * e-mail ficam no servidor — dado que não trafega para o cliente não vaza
 * dele.
 */
export async function usuarioParaNavegacao(): Promise<UsuarioVisivel | null> {
  // Sem Supabase configurado, criar o cliente lançaria. Em desenvolvimento o
  // sistema roda aberto, então ausência de usuário é estado esperado.
  if (!authConfigurada) return null

  const usuario = await usuarioAtual()
  if (!usuario) return null

  return {
    nome: usuario.nome,
    perfil: ROTULO_PERFIL[usuario.perfil],
    podeImportar: podeImportar(usuario),
  }
}
