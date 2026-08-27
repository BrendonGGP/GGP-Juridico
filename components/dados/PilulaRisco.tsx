import type { Risco } from '@/lib/calculo/cenarios'

/**
 * Pílula de risco.
 *
 * A referência de layout usa pílulas coloridas para status. Aqui a cor é
 * apenas reforço: o rótulo em texto sempre aparece, e a borda dá um segundo
 * sinal de forma. Um relatório de provisionamento lido em impressão
 * monocromática precisa continuar legível.
 *
 * Os tons são sóbrios em vez do verde/vermelho saturado do mock, para
 * conviver com a paleta da marca. Todos verificados em ≥ 4.5:1 sobre o
 * próprio fundo.
 */

const ESTILO: Record<Risco, { rotulo: string; classe: string }> = {
  PROVAVEL: {
    rotulo: 'Provável',
    classe:
      'text-[var(--risco-provavel-texto)] bg-[var(--risco-provavel-fundo)] border-[var(--risco-provavel-borda)]',
  },
  POSSIVEL: {
    rotulo: 'Possível',
    classe:
      'text-[var(--risco-possivel-texto)] bg-[var(--risco-possivel-fundo)] border-[var(--risco-possivel-borda)]',
  },
  REMOTO: {
    rotulo: 'Remoto',
    classe:
      'text-[var(--risco-remoto-texto)] bg-[var(--risco-remoto-fundo)] border-[var(--risco-remoto-borda)]',
  },
}

export function PilulaRisco({ risco }: { risco: Risco | null }) {
  if (risco === null) {
    return (
      <span className="inline-flex items-center rounded-full border border-borda-forte px-2 py-0.5 text-xs text-texto-suave">
        Sem risco informado
      </span>
    )
  }

  const { rotulo, classe } = ESTILO[risco]
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${classe}`}
    >
      {rotulo}
    </span>
  )
}

/** Etiqueta neutra para marcar natureza do processo (Trabalhista, IDPJ). */
export function Etiqueta({ texto }: { texto: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-borda-forte bg-fundo px-2 py-0.5 text-xs text-texto-suave">
      {texto}
    </span>
  )
}
