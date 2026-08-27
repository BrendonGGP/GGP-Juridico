'use client'

import { useRef, useState } from 'react'

/**
 * Formulário de acesso.
 *
 * ATENÇÃO — esta tela AINDA NÃO AUTENTICA. Não valida senha, não cria sessão,
 * não define cookie e não dá acesso a nada. Ligar a autenticação de verdade é
 * alteração de política de segurança e depende de aprovação explícita
 * (ver CLAUDE.md). Enquanto isso, o envio explica o estado em vez de fingir
 * um login — um formulário que aparenta funcionar e não funciona é pior que
 * um que diz o que é.
 *
 * O que já está pronto e não muda quando a autenticação chegar:
 *
 *  - `action` e `method` reais, para funcionar sem JavaScript;
 *  - `autoComplete` correto, para o gerenciador de senhas do navegador;
 *  - erro anunciado por `role="alert"` com foco levado ao resumo;
 *  - a senha nunca é registrada em log nem ecoada na tela.
 */

export function FormularioLogin() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const avisoRef = useRef<HTMLDivElement>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()

    if (!email.trim() || !senha) {
      mostrar('Preencha o e-mail e a senha.')
      return
    }

    setEnviando(true)
    // Espera curta só para o estado de carregamento ser perceptível; será
    // substituída pela chamada real de autenticação.
    await new Promise(r => setTimeout(r, 400))
    setEnviando(false)

    mostrar(
      'A autenticação ainda não está ativa. Esta tela está pronta, mas o ' +
        'login de verdade entra numa próxima etapa, junto com o log de auditoria.'
    )
  }

  function mostrar(texto: string) {
    setAviso(texto)
    // Acessibilidade: leva o foco ao aviso, senão quem usa leitor de tela não
    // descobre que algo apareceu abaixo do botão.
    requestAnimationFrame(() => avisoRef.current?.focus())
  }

  return (
    <form onSubmit={enviar} noValidate className="mt-6 space-y-5">
      <Campo
        id="email"
        rotulo="E-mail"
        tipo="email"
        autoComplete="username"
        valor={email}
        onChange={setEmail}
        placeholder="nome@grupogomespires.com.br"
      />

      <Campo
        id="senha"
        rotulo="Senha"
        tipo="password"
        autoComplete="current-password"
        valor={senha}
        onChange={setSenha}
      />

      <button
        type="submit"
        disabled={enviando}
        className="min-h-11 w-full cursor-pointer rounded-ggp-sm bg-primaria px-5 text-sm font-semibold text-sobre-primaria transition-colors duration-150 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>

      <p aria-live="polite" className="sr-only">
        {enviando ? 'Verificando o acesso.' : ''}
      </p>

      {aviso && (
        <div
          ref={avisoRef}
          role="alert"
          tabIndex={-1}
          className="rounded-ggp-sm border border-[var(--cor-atencao-texto)] bg-atencao-fundo p-3 text-sm text-atencao-texto"
        >
          {aviso}
        </div>
      )}
    </form>
  )
}

function Campo({
  id,
  rotulo,
  tipo,
  autoComplete,
  valor,
  onChange,
  placeholder,
}: {
  id: string
  rotulo: string
  tipo: 'email' | 'password'
  autoComplete: string
  valor: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      {/* Rótulo visível, nunca só placeholder: o placeholder some ao digitar
          e leva embora a única pista do que o campo pede. */}
      <label htmlFor={id} className="block text-sm font-medium text-texto">
        {rotulo}
      </label>
      <input
        id={id}
        name={id}
        type={tipo}
        autoComplete={autoComplete}
        required
        value={valor}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="mt-1.5 min-h-11 w-full rounded-ggp-sm border border-borda-forte bg-superficie px-3 text-sm text-texto placeholder:text-texto-suave/70"
      />
    </div>
  )
}
