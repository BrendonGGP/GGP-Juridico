'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/auth/cliente'
import { prisma } from '@/lib/db'
import { registrar } from '@/lib/auth/auditoria'

/**
 * Sair do sistema.
 *
 * Vive em arquivo separado de `acoes.ts` por uma razão de bundling, não de
 * organização: a Sidebar é Client Component, e importar dela um módulo que
 * também exporta `entrar` arrastaria `next/headers` e o Prisma para o bundle
 * do navegador — o build falha, e com razão.
 *
 * Um arquivo 'use server' com uma única ação mantém a fronteira nítida: o
 * cliente recebe apenas a referência da ação, nunca o código do servidor.
 */
export async function sair() {
  const supabase = await clienteServidor()

  const { data } = await supabase.auth.getUser()
  if (data.user?.email) {
    const usuario = await prisma.usuario.findUnique({
      where: { email: data.user.email.toLowerCase() },
      select: { id: true },
    })
    if (usuario) await registrar({ usuarioId: usuario.id, acao: 'LOGOUT' })
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
