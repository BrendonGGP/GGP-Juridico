'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '../marca/Logo'
import {
  IconePainel,
  IconeVisaoExecutiva,
  IconeRelatorio,
  IconeImportacao,
} from '../icones'

/**
 * Navegação lateral.
 *
 * O estado ativo é marcado por três sinais simultâneos — barra à esquerda,
 * fundo suave e peso da fonte — e por `aria-current="page"`. Cor sozinha não
 * comunica posição para quem não a distingue.
 *
 * O fundo é claro (não o grafite do manual) porque a referência de layout
 * escolhida é clara e o Relatório Executivo vai para PDF. A identidade fica
 * no logo e no teal do item ativo.
 */

interface ItemNav {
  href: string
  rotulo: string
  Icone: (p: { className?: string }) => React.ReactElement
}

const ITENS: ItemNav[] = [
  { href: '/', rotulo: 'Visão Executiva', Icone: IconeVisaoExecutiva },
  { href: '/dashboard', rotulo: 'Dashboard', Icone: IconePainel },
  { href: '/relatorio', rotulo: 'Relatório Executivo', Icone: IconeRelatorio },
  { href: '/importacao', rotulo: 'Importação mensal', Icone: IconeImportacao },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegação principal"
      data-print="ocultar"
      className="flex w-full shrink-0 flex-col border-b border-borda bg-superficie md:h-dvh md:w-60 md:border-r md:border-b-0"
    >
      <div
        className="flex items-center gap-3 border-b border-borda"
        style={{ padding: 'calc(var(--logo-respiro) * 1.5) var(--logo-respiro)' }}
      >
        <Logo altura={44} />
        <span className="text-sm font-semibold tracking-tight text-texto">Jurídico</span>
      </div>

      <ul className="flex flex-1 gap-1 overflow-x-auto p-3 md:flex-col md:overflow-visible">
        {ITENS.map(({ href, rotulo, Icone }) => {
          const ativo = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={ativo ? 'page' : undefined}
                className={[
                  'relative flex min-h-11 items-center gap-3 rounded-ggp-sm px-3 text-sm',
                  'transition-colors duration-150',
                  ativo
                    ? 'bg-primaria-suave font-semibold text-primaria-texto'
                    : 'text-texto-suave hover:bg-fundo hover:text-texto',
                ].join(' ')}
              >
                {/* Barra à esquerda: segundo sinal do estado ativo. */}
                {ativo && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primaria"
                  />
                )}
                <Icone className="shrink-0" />
                <span className="whitespace-nowrap">{rotulo}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      <p className="hidden px-4 pb-4 text-[0.6875rem] leading-relaxed text-texto-suave md:block">
        Dados de uso interno. Não compartilhe fora do Jurídico.
      </p>
    </nav>
  )
}
