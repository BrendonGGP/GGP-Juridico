import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { config as ambiente, authConfigurada } from './lib/config.ts'

/**
 * Trava de acesso do sistema.
 *
 * FAIL-CLOSED: a lista abaixo enumera o que é PÚBLICO. Tudo o mais exige
 * sessão. Uma tela nova nasce protegida sem ninguém precisar lembrar de
 * protegê-la — o contrário (lista de rotas privadas) deixaria cada página
 * futura aberta por omissão, e é assim que dado vaza.
 *
 * O middleware também RENOVA o token a cada requisição. Sem isso a sessão
 * expiraria no meio do uso, e Server Components não conseguem gravar cookie
 * para consertar sozinhos.
 *
 * O que ele NÃO faz: checar perfil. Aqui só se verifica se há sessão válida.
 * Quem pode importar ou administrar é decidido na rota e na API, com o perfil
 * lido do banco (lib/auth/sessao.ts). Middleware roda no Edge, sem acesso ao
 * Prisma; tentar decidir autorização aqui exigiria confiar no token, que dura
 * horas e não reflete uma revogação imediata.
 */

/** Rotas acessíveis sem sessão. Prefixos — `/login` cobre `/login/qualquer`. */
const PUBLICAS = ['/login', '/auth', '/definir-senha']

const ehPublica = (caminho: string) =>
  PUBLICAS.some(p => caminho === p || caminho.startsWith(`${p}/`))

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  /**
   * Sem Supabase configurado, o sistema roda ABERTO — é o estado de hoje, em
   * desenvolvimento, e o aviso na tela de login diz isso.
   *
   * Em produção isso seria um fail-open: sem as chaves, todo o painel ficaria
   * exposto. Então em produção a ausência de configuração BLOQUEIA em vez de
   * liberar. Errar para o lado fechado é o único desfecho aceitável numa
   * trava de acesso.
   */
  if (!authConfigurada) {
    if (ambiente.APP_ENV === 'production' && !ehPublica(pathname)) {
      return NextResponse.redirect(new URL('/login?erro=nao-configurado', request.url))
    }
    return NextResponse.next({ request })
  }

  // A resposta precisa existir antes do cliente: é nela que o token renovado
  // é gravado.
  let resposta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: cookiesParaGravar => {
          cookiesParaGravar.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          resposta = NextResponse.next({ request })
          cookiesParaGravar.forEach(({ name, value, options }) =>
            resposta.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() valida o token no servidor do Supabase. getSession() só lê o
  // cookie, e um cookie forjado passaria por ele.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !ehPublica(pathname)) {
    const destino = new URL('/login', request.url)
    // Guarda para onde a pessoa ia, para voltar lá depois de entrar. Só o
    // caminho relativo: uma URL absoluta vinda de fora viraria open redirect.
    if (pathname !== '/') destino.searchParams.set('proximo', pathname)
    return NextResponse.redirect(destino)
  }

  // Quem já entrou não precisa ver a tela de login de novo.
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return resposta
}

export const config = {
  /**
   * Ignora arquivos estáticos e imagens — eles não carregam dado de processo e
   * validar token em cada ícone só adicionaria latência.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|marca/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
