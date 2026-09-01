'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/auth/cliente'
import { prisma } from '@/lib/db'
import { registrar } from '@/lib/auth/auditoria'
import type { ResultadoLogin } from './tipos'

/**
 * Entrar e sair do sistema.
 *
 * Regra que atravessa este módulo: a mensagem de erro é sempre a MESMA,
 * qualquer que seja a causa — senha errada, e-mail inexistente, conta
 * desativada, usuário sem convite.
 *
 * Distinguir "e-mail não cadastrado" de "senha incorreta" transformaria a
 * tela de login num verificador de quem trabalha aqui: bastaria testar
 * endereços e ver qual mensagem volta. Num sistema do Jurídico, isso já é
 * informação demais para quem está do lado de fora.
 */

const ERRO_GENERICO = 'E-mail ou senha inválidos.'

export async function entrar(
  _anterior: ResultadoLogin | null,
  form: FormData
): Promise<ResultadoLogin> {
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase()
  const senha = String(form.get('senha') ?? '')
  const proximo = String(form.get('proximo') ?? '')

  if (!email || !senha) {
    return { erro: 'Preencha o e-mail e a senha.' }
  }

  const supabase = await clienteServidor()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })

  if (error || !data.user) {
    return { erro: ERRO_GENERICO }
  }

  /**
   * Autenticado no Supabase ainda não é autorizado aqui.
   *
   * A tabela `usuario` é a lista de convidados. Alguém pode existir no
   * Supabase e não estar nela — ou estar, mas desativado. Nos dois casos,
   * derruba a sessão e devolve o erro genérico.
   */
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, ativo: true },
  })

  if (!usuario || !usuario.ativo) {
    await supabase.auth.signOut()
    await registrar({
      acao: 'LOGIN_NEGADO',
      // Sem PII: o motivo, não quem tentou.
      detalhe: { motivo: usuario ? 'conta desativada' : 'sem cadastro' },
    })
    return { erro: ERRO_GENERICO }
  }

  await registrar({ usuarioId: usuario.id, acao: 'LOGIN' })

  revalidatePath('/', 'layout')

  /**
   * Só caminho interno. `proximo` vem da URL e é entrada não confiável: sem
   * esta checagem, um link para `/login?proximo=https://site-falso` levaria a
   * pessoa para fora depois de entrar — um open redirect clássico, útil em
   * phishing. `//host` também é URL absoluta, por isso é rejeitado.
   */
  const destino = proximo.startsWith('/') && !proximo.startsWith('//') ? proximo : '/'
  redirect(destino)
}
