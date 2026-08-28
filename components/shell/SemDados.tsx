import Link from 'next/link'
import { IconeImportacao } from '../icones'

/**
 * Estado de sistema sem nenhuma importação concluída.
 *
 * Existe para que o painel nunca mostre uma tela de zeros. Zero é uma
 * afirmação sobre a carteira; "ainda não importamos" é outra coisa, e
 * confundir as duas num painel de provisionamento leva a decisão errada.
 */
export function SemDados() {
  return (
    <div className="rounded-ggp border border-dashed border-borda-forte bg-superficie p-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primaria-suave text-primaria-texto">
        <IconeImportacao />
      </div>
      <h2 className="mt-4 text-base font-semibold">Nenhuma importação concluída</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-texto-suave">
        Os indicadores aparecem depois que a primeira planilha mensal for
        importada. Nada é exibido como zero até lá — um painel zerado se
        confunde com uma carteira vazia.
      </p>
      <Link
        href="/importacao"
        className="mt-5 inline-flex min-h-11 cursor-pointer items-center rounded-ggp-sm bg-primaria px-5 text-sm font-medium text-sobre-primaria transition-colors duration-150 hover:brightness-95"
      >
        Ir para a importação
      </Link>
    </div>
  )
}
