'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { AcaoLogin, ResultadoLogin } from './tipos'

/**
 * Formulário de acesso.
 *
 * Agora AUTENTICA de verdade, via Supabase Auth (ver app/login/acoes.ts).
 *
 * Decisões que continuam valendo da versão anterior:
 *
 *  - `action` real de Server Action: funciona sem JavaScript no cliente.
 *  - `autoComplete` correto, para o gerenciador de senhas do navegador.
 *  - rótulo visível nos dois campos — placeholder some ao digitar e leva
 *    embora a única pista do que o campo pede.
 *  - erro anunciado por `role="alert"`, para quem usa leitor de tela saber
 *    que algo apareceu abaixo do botão.
 *
 * A senha nunca é ecoada de volta: num erro, o campo volta vazio. O React
 * não a mantém em estado, e ela não trafega para o cliente na resposta.
 */

export function FormularioLogin({
  acaoEntrar,
  proximo,
  avisoInicial,
}: {
  /** Server Action de login, recebida por prop: importá-la aqui traria
   *  next/headers e o Prisma para o bundle do navegador. */
  acaoEntrar: AcaoLogin
  /** Para onde voltar depois de entrar. Validado no servidor. */
  proximo?: string
  /** Mensagem vinda da URL, como a de sessão expirada. */
  avisoInicial?: string
}) {
  const [estado, acao] = useActionState<ResultadoLogin | null, FormData>(acaoEntrar, null)
  const erro = estado?.erro ?? avisoInicial

  return (
    <form action={acao} className="mt-6 space-y-5">
      {proximo && <input type="hidden" name="proximo" value={proximo} />}

      <Campo
        id="email"
        rotulo="E-mail"
        tipo="email"
        autoComplete="username"
        placeholder="nome@grupogomespires.com.br"
      />
      <Campo id="senha" rotulo="Senha" tipo="password" autoComplete="current-password" />

      <Botao />

      {erro && (
        <div
          role="alert"
          className="rounded-ggp-sm border border-[var(--cor-erro-texto)] bg-erro-fundo p-3 text-sm text-erro-texto"
        >
          {erro}
        </div>
      )}
    </form>
  )
}

/**
 * Botão separado porque `useFormStatus` só enxerga o envio quando está DENTRO
 * do form — chamá-lo no componente pai devolveria `pending` sempre falso.
 */
function Botao() {
  const { pending } = useFormStatus()

  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full cursor-pointer rounded-ggp-sm bg-primaria px-5 text-sm font-semibold text-sobre-primaria transition-colors duration-150 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
      <p aria-live="polite" className="sr-only">
        {pending ? 'Verificando o acesso.' : ''}
      </p>
    </>
  )
}

function Campo({
  id,
  rotulo,
  tipo,
  autoComplete,
  placeholder,
}: {
  id: string
  rotulo: string
  tipo: 'email' | 'password'
  autoComplete: string
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-texto">
        {rotulo}
      </label>
      <input
        id={id}
        name={id}
        type={tipo}
        autoComplete={autoComplete}
        required
        placeholder={placeholder}
        className="mt-1.5 min-h-11 w-full rounded-ggp-sm border border-borda-forte bg-superficie px-3 text-sm text-texto placeholder:text-texto-suave/70"
      />
    </div>
  )
}
