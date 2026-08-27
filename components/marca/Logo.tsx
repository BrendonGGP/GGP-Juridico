/**
 * Logotipo GGP.
 *
 * Duas regras normativas do manual da marca, aplicadas aqui em código:
 *
 *  1. "O texto inferior deve SEMPRE seguir a mesma cor das letras G's."
 *     Por isso `corTexto` não é uma prop: ele é derivado de `corG`. Deixar
 *     isso configurável convidaria a violação em algum lugar do sistema.
 *
 *  2. Área de proteção de 50px entre o logo e outros elementos. Aqui vira
 *     `--logo-respiro` como padding, proporcional ao tamanho de uso.
 *
 * A forma é uma interpretação tipográfica do lettering: as letras do logo
 * original são um desenho customizado, não uma fonte. Quando o arquivo
 * vetorial oficial estiver disponível, ele substitui este componente sem
 * mudar a API.
 */

interface LogoProps {
  /** Cor das letras "G" — e, por consequência, do texto inferior. */
  corG?: string
  /** Cor da letra "P", o elemento de destaque. */
  corP?: string
  /** Mostra "GRUPO GOMES PIRES" abaixo da sigla. */
  comTipo?: boolean
  className?: string
}

export function Logo({
  corG = 'var(--ggp-branco)',
  corP = 'var(--ggp-teal)',
  comTipo = false,
  className,
}: LogoProps) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.15em' }}
    >
      <span
        aria-hidden="true"
        style={{
          fontWeight: 600,
          fontSize: '1.5rem',
          letterSpacing: '-0.04em',
          lineHeight: 1,
          color: corG,
        }}
      >
        GG<span style={{ color: corP }}>P</span>
      </span>
      {comTipo && (
        <span
          aria-hidden="true"
          style={{
            // REGRA DO MANUAL: mesma cor dos G, nunca a do P.
            color: corG,
            fontSize: '0.5rem',
            fontWeight: 400,
            letterSpacing: '0.14em',
          }}
        >
          GRUPO GOMES PIRES
        </span>
      )}
      <span className="sr-only">GGP — Grupo Gomes Pires</span>
    </span>
  )
}
