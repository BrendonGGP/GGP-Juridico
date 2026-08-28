'use client'

import { CENARIOS, ROTULO_CENARIO, MATRIZ_CENARIOS, type Cenario } from '@/lib/calculo/cenarios'

/**
 * Escolha do cenário de provisionamento.
 *
 * É um grupo de rádio, não abas nem botões soltos: as três opções são
 * mutuamente exclusivas e navegáveis por seta no teclado, que é o que o
 * papel de rádio entrega de graça.
 *
 * O percentual de cada cenário aparece no `title` e no texto de apoio. Quem
 * lê "R$ 18,9 milhões" precisa poder descobrir, sem sair da tela, que aquilo
 * significa Possível contado pela metade.
 */

export function SeletorCenario({
  valor,
  onChange,
}: {
  valor: Cenario
  onChange: (c: Cenario) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Cenário de provisionamento"
      className="inline-flex rounded-ggp-sm border border-borda bg-superficie p-0.5"
    >
      {CENARIOS.map(c => {
        const ativo = c === valor
        const m = MATRIZ_CENARIOS[c]
        const resumo = `Provável ${m.PROVAVEL * 100}% · Possível ${m.POSSIVEL * 100}% · Remoto ${m.REMOTO * 100}%`
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={ativo}
            title={resumo}
            onClick={() => onChange(c)}
            className={[
              'min-h-11 cursor-pointer rounded-ggp-sm px-4 text-sm transition-colors duration-150',
              ativo
                ? 'bg-primaria font-semibold text-sobre-primaria'
                : 'text-texto-suave hover:bg-fundo hover:text-texto',
            ].join(' ')}
          >
            {ROTULO_CENARIO[c]}
          </button>
        )
      })}
    </div>
  )
}

/** Explica, por extenso, o que o cenário selecionado faz com cada risco. */
export function ExplicacaoCenario({ cenario }: { cenario: Cenario }) {
  const m = MATRIZ_CENARIOS[cenario]
  return (
    <p className="text-sm text-texto-suave">
      No cenário <strong className="font-semibold text-texto">{ROTULO_CENARIO[cenario]}</strong>, o
      passivo conta {m.PROVAVEL * 100}% dos processos de risco Provável,{' '}
      {m.POSSIVEL * 100}% dos Possíveis e {m.REMOTO * 100}% dos Remotos.
    </p>
  )
}
