import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/marca/Logo'
import { PainelMarca } from '@/components/marca/PainelMarca'
import { FormularioLogin } from './FormularioLogin'

/**
 * Tela de acesso.
 *
 * Segue a estrutura do Portal GGP — duas colunas, marca à esquerda, cartão de
 * acesso à direita — em tema claro, para ficar coerente com o painel.
 *
 * Não usa a casca `Pagina`: não há navegação lateral antes de entrar.
 *
 * A AUTENTICAÇÃO AINDA NÃO ESTÁ ATIVA (ver FormularioLogin.tsx). Como
 * consequência, esta tela ainda não protege nada — as rotas do painel
 * continuam abertas. Isso muda na etapa de autenticação.
 */

export const metadata: Metadata = {
  title: 'Acesso — GGP-Jurídico',
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* --- Coluna da marca ---------------------------------------- */}
      <section className="relative flex flex-col justify-center overflow-hidden bg-primaria-suave px-8 py-12 sm:px-14">
        <PainelMarca className="pointer-events-none absolute inset-0 h-full w-full text-primaria" />

        <div className="relative">
          <Logo fundo="claro" altura={72} prioridade />

          <h1 className="mt-10 text-4xl font-bold tracking-tight text-texto sm:text-5xl">
            Bem-vindo.
          </h1>
          <span aria-hidden="true" className="mt-4 block h-1 w-16 rounded-full bg-primaria" />

          <p className="mt-5 max-w-sm text-base leading-relaxed text-texto-suave">
            Gestão e indicadores do Jurídico: provisionamento de risco, projeção
            de desembolso e relatório executivo, sempre em um só lugar.
          </p>

          <Link
            href="/"
            className="mt-8 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-primaria px-6 text-sm font-semibold text-sobre-primaria transition-colors duration-150 hover:brightness-95"
          >
            Conheça o sistema
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* --- Coluna do acesso ---------------------------------------- */}
      <section className="flex items-center justify-center bg-fundo px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm rounded-ggp border border-borda bg-superficie p-7 shadow-elevada">
          <h2 className="text-xl font-semibold tracking-tight text-texto">
            Acesso ao sistema
          </h2>
          <p className="mt-1 text-sm text-texto-suave">
            Use o e-mail corporativo cadastrado pelo Jurídico.
          </p>

          <FormularioLogin />

          <p className="mt-6 border-t border-borda pt-4 text-xs leading-relaxed text-texto-suave">
            O acesso é concedido por convite, com perfil definido no convite.
            Em caso de dúvida, procure o Jurídico.
          </p>
        </div>
      </section>
    </div>
  )
}
