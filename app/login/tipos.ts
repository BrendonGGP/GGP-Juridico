/**
 * Tipos compartilhados entre a tela de login e as ações de servidor.
 *
 * Vivem separados porque o formulário é Client Component: importar o tipo
 * direto de `acoes.ts` faria o bundler arrastar o módulo inteiro — com
 * `next/headers`, Prisma e Supabase — para o bundle do navegador.
 *
 * Um arquivo só de tipos não gera JavaScript, então atravessa a fronteira
 * cliente/servidor sem custo nem risco.
 */

export interface ResultadoLogin {
  erro: string
}

/** Assinatura da Server Action de login, para ser recebida por prop. */
export type AcaoLogin = (
  anterior: ResultadoLogin | null,
  form: FormData
) => Promise<ResultadoLogin>
