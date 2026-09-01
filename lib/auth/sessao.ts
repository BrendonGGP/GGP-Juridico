import type { Perfil } from '@prisma/client'
import { clienteServidor } from './cliente.ts'
import { prisma } from '../db.ts'

/**
 * Quem está usando o sistema, e o que pode fazer.
 *
 * A identidade vem do Supabase Auth (quem provou ser quem diz), mas o PERFIL
 * vem da nossa tabela `usuario`. São coisas separadas de propósito:
 *
 *   - autenticação  = você é você
 *   - autorização   = você pode fazer isto
 *
 * Guardar o perfil no token do Supabase pareceria mais simples, mas o token
 * dura horas: revogar o acesso de alguém só teria efeito quando ele expirasse.
 * Lendo do banco a cada requisição, desativar um usuário vale na hora — que é
 * o que se espera de uma revogação num sistema com dado jurídico.
 */

export interface Usuario {
  id: string
  email: string
  nome: string
  perfil: Perfil
}

/**
 * O usuário da requisição atual, ou null.
 *
 * Devolve null em TODOS os casos de dúvida: sem sessão, e-mail não cadastrado
 * na nossa base, ou conta desativada. Quem chama trata null como "não pode" —
 * nunca como "provavelmente pode".
 *
 * Um usuário autenticado no Supabase mas ausente da tabela `usuario` não é
 * erro do sistema: é alguém sem convite. Também devolve null.
 */
export async function usuarioAtual(): Promise<Usuario | null> {
  const supabase = await clienteServidor()

  // getUser() valida o token contra o servidor do Supabase. getSession() lê o
  // cookie sem validar — um cookie forjado passaria. A diferença importa.
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.email) return null

  const usuario = await prisma.usuario.findUnique({
    where: { email: data.user.email.toLowerCase() },
    select: { id: true, email: true, nome: true, perfil: true, ativo: true },
  })

  if (!usuario || !usuario.ativo) return null

  return {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    perfil: usuario.perfil,
  }
}

// ---------------------------------------------------------------------------
// AUTORIZAÇÃO POR PERFIL
// ---------------------------------------------------------------------------

/**
 * Quem pode ESCREVER na base de processos.
 *
 * Importar uma planilha substitui a foto do mês inteiro. Diretoria e
 * Contabilidade consomem o resultado; não há razão para poderem reescrevê-lo.
 * Não poder é mais seguro que poder e não usar.
 */
const PERFIS_QUE_IMPORTAM: readonly Perfil[] = ['ADMIN', 'JURIDICO']

/** Quem pode gerenciar usuários. */
const PERFIS_QUE_ADMINISTRAM: readonly Perfil[] = ['ADMIN']

export const podeImportar = (u: Usuario | null): boolean =>
  u !== null && PERFIS_QUE_IMPORTAM.includes(u.perfil)

export const podeAdministrar = (u: Usuario | null): boolean =>
  u !== null && PERFIS_QUE_ADMINISTRAM.includes(u.perfil)

/**
 * Ler os painéis. Qualquer usuário ativo e cadastrado pode.
 *
 * Existe como função, e não como `u !== null` espalhado pelas telas, para que
 * restringir a leitura no futuro seja uma mudança num lugar só.
 */
export const podeLer = (u: Usuario | null): boolean => u !== null

/** Rótulos para exibição. */
export const ROTULO_PERFIL: Record<Perfil, string> = {
  ADMIN: 'Administrador',
  JURIDICO: 'Jurídico',
  DIRETORIA: 'Diretoria',
  CONTABILIDADE: 'Contabilidade',
}
