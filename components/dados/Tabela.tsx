/**
 * Tabela densa, no padrão da referência de layout.
 *
 * Três decisões que não vêm do mock:
 *
 *  - `caption` sempre presente (visualmente oculta quando redundante), porque
 *    quem navega por leitor de tela precisa saber o que a tabela contém antes
 *    de entrar nela.
 *  - `overflow-x-auto` no invólucro: a tabela rola dentro de si, a página
 *    nunca rola na horizontal.
 *  - Números com `tabular-nums` e alinhados à direita, para as casas
 *    ficarem em coluna e o olho comparar magnitude.
 */

export function Tabela({
  legenda,
  legendaVisivel,
  cabecalho,
  children,
  larguraMinima = '48rem',
  vazio,
}: {
  legenda: string
  legendaVisivel?: boolean
  cabecalho: { rotulo: string; numerico?: boolean }[]
  children: React.ReactNode
  larguraMinima?: string
  /** Mostrado no lugar do corpo quando não há linhas. */
  vazio?: React.ReactNode
}) {
  if (vazio) {
    return (
      <div className="rounded-ggp-sm border border-dashed border-borda-forte p-6 text-center text-sm text-texto-suave">
        {vazio}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth: larguraMinima }}>
        <caption
          className={
            legendaVisivel ? 'mb-2 text-left text-sm text-texto-suave' : 'sr-only'
          }
        >
          {legenda}
        </caption>
        <thead>
          <tr className="border-b border-borda-forte text-left">
            {cabecalho.map(c => (
              <th
                key={c.rotulo}
                scope="col"
                className={[
                  'whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-texto-suave',
                  c.numerico ? 'text-right' : '',
                ].join(' ')}
              >
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Linha({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-borda align-middle last:border-b-0 hover:bg-fundo">
      {children}
    </tr>
  )
}

export function Celula({
  children,
  numerico,
  className,
}: {
  children: React.ReactNode
  numerico?: boolean
  className?: string
}) {
  return (
    <td
      className={[
        'px-3 py-2.5',
        numerico ? 'text-right tabular-nums' : '',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </td>
  )
}

/**
 * Número de processo mascarado.
 *
 * `numero_processo` não está na lista de campos sensíveis do CLAUDE.md, mas
 * identifica a parte quando cruzado com consulta pública. O padrão CNJ é
 * NNNNNNN-DD.AAAA.J.TR.OOOO; preservamos ano e órgão, que dão contexto, e
 * escondemos o sequencial, que individualiza.
 *
 * A forma completa continua acessível a quem precisa — mas por ação
 * deliberada, não por padrão numa tela projetada em telão de diretoria.
 */
export function NumeroProcesso({
  numero,
  revelar,
}: {
  numero: string | null
  revelar?: boolean
}) {
  if (!numero) return <span className="text-texto-suave">—</span>
  if (revelar) return <span className="tabular-nums">{numero}</span>

  const cnj = /^(\d{7})(-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})$/.exec(numero.trim())
  if (cnj) {
    return (
      <span className="tabular-nums" title="Número parcialmente ocultado">
        <span aria-hidden="true">•••••••</span>
        <span className="sr-only">sequencial ocultado</span>
        {cnj[2]}
      </span>
    )
  }

  // Formato fora do padrão CNJ (inclui "A DISTRIBUIR"): mostra como está.
  return <span className="tabular-nums">{numero}</span>
}
