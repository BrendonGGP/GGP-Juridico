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
import type { UsuarioVisivel } from './tipos'

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
  /** Só aparece para quem pode importar. */
  exigeImportar?: boolean
}

const ITENS: ItemNav[] = [
  { href: '/', rotulo: 'Visão Executiva', Icone: IconeVisaoExecutiva },
  { href: '/dashboard', rotulo: 'Dashboard', Icone: IconePainel },
  { href: '/relatorio', rotulo: 'Relatório Executivo', Icone: IconeRelatorio },
  { href: '/importacao', rotulo: 'Importação mensal', Icone: IconeImportacao, exigeImportar: true },
]

export function Sidebar({
  usuario,
  aoSair,
}: {
  usuario?: UsuarioVisivel | null
  /**
   * Server Action de logout, recebida por prop.
   *
   * Importá-la aqui arrastaria `next/headers` e o Prisma para o bundle do
   * navegador — o build falha, e com razão. Recebida como prop, o cliente
   * fica só com a referência da ação; o código continua no servidor.
   */
  aoSair?: () => Promise<void>
}) {
  const pathname = usePathname()

  /**
   * Esconder o item não é a proteção — é cortesia com quem não pode usá-lo.
   * A trava de verdade está na API (app/api/importacao/preview/route.ts), que
   * recusa mesmo se alguém digitar o endereço direto.
   */
  const itens = ITENS.filter(i => !i.exigeImportar || usuario?.podeImportar !== false)

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
        <Logo fundo="claro" altura={26} />
        <span className="text-sm font-semibold tracking-tight text-texto">Jurídico</span>
      </div>

      <ul className="flex flex-1 gap-1 overflow-x-auto p-3 md:flex-col md:overflow-visible">
        {itens.map(({ href, rotulo, Icone }) => {
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

      {usuario && (
        <div className="border-t border-borda px-4 py-3">
          <p className="truncate text-sm font-medium text-texto" title={usuario.nome}>
            {usuario.nome}
          </p>
          <p className="text-xs text-texto-suave">{usuario.perfil}</p>
          <form action={aoSair}>
            <button
              type="submit"
              className="mt-2 min-h-11 cursor-pointer text-sm text-primaria-texto underline-offset-2 hover:underline"
            >
              Sair
            </button>
          </form>
        </div>
      )}

      <p className="hidden px-4 pb-4 text-[0.6875rem] leading-relaxed text-texto-suave md:block">
        Dados de uso interno. Não compartilhe fora do Jurídico.
      </p>
    </nav>
  )
}
