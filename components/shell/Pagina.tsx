import { Sidebar } from './Sidebar'

/**
 * Casca das telas: sidebar + faixa de topo + conteúdo.
 *
 * A faixa de topo segue a referência — título à esquerda, controles à
 * direita — mas os controles são passados por prop em vez de fixados aqui,
 * porque cada tela tem os seus (seletor de cenário, período, exportação).
 */

export function Pagina({
  titulo,
  descricao,
  acoes,
  children,
}: {
  titulo: string
  descricao?: string
  acoes?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-col gap-3 border-b border-borda bg-superficie px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{titulo}</h1>
            {descricao && (
              <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>
            )}
          </div>
          {acoes && (
            <div
              data-print="ocultar"
              className="flex flex-wrap items-center gap-3"
            >
              {acoes}
            </div>
          )}
        </header>

        <main className="flex-1 px-5 py-6">{children}</main>
      </div>
    </div>
  )
}

/** Cartão branco sobre o fundo cinza — a unidade de conteúdo da referência. */
export function Cartao({
  titulo,
  descricao,
  acoes,
  children,
  className,
}: {
  titulo?: string
  descricao?: string
  acoes?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={[
        'rounded-ggp border border-borda bg-superficie p-5 shadow-cartao',
        className ?? '',
      ].join(' ')}
    >
      {(titulo || acoes) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {titulo && <h2 className="text-base font-semibold tracking-tight">{titulo}</h2>}
            {descricao && <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>}
          </div>
          {acoes && <div className="flex items-center gap-2">{acoes}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
