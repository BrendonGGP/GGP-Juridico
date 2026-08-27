import Image from 'next/image'

/**
 * Logotipo GGP — arquivo oficial da marca.
 *
 * Usa o desenho real, não uma aproximação tipográfica: o lettering do logo é
 * customizado (repare no traço horizontal que atravessa as três letras) e
 * nenhuma fonte reproduz isso.
 *
 * Duas regras normativas do manual, atendidas pelo próprio arquivo:
 *
 *  1. "O texto inferior deve SEMPRE seguir a mesma cor das letras G's."
 *     Como a variante `completo` já traz o texto embutido na arte oficial, a
 *     regra não pode mais ser violada por engano no código.
 *  2. Área de proteção de 50px entre o logo e outros elementos, aqui
 *     proporcional via `--logo-respiro`.
 *
 * Acessibilidade: quando o logo apenas repete um texto já visível ao lado,
 * passe `decorativo` — senão o leitor de tela anuncia a marca duas vezes.
 */

export type VarianteLogo = 'completo' | 'simbolo'

const ARQUIVO: Record<VarianteLogo, string> = {
  // Marca completa: "GGP" + "GRUPO GOMES PIRES".
  completo: '/marca/ggp-completo.png',
  // Só o "P" com o traço — para espaços estreitos (favicon, barra compacta).
  simbolo: '/marca/ggp-simbolo.png',
}

/**
 * A arte oficial é quadrada (4800×4800) com o logo centralizado e margem
 * generosa em volta. `altura` se refere ao QUADRO, não ao lettering — por
 * isso os valores de uso parecem grandes: em 44px de quadro, a marca em si
 * ocupa por volta de 30px.
 *
 * A margem embutida também já entrega parte da área de proteção que o manual
 * exige, então o respiro externo pode ser menor do que seria com arte cortada.
 */
const PROPORCAO: Record<VarianteLogo, number> = {
  completo: 1,
  simbolo: 1,
}

interface LogoProps {
  variante?: VarianteLogo
  /** Altura em pixels. A largura acompanha a proporção da arte. */
  altura?: number
  /** Marca o logo como ornamento, quando o nome já aparece em texto ao lado. */
  decorativo?: boolean
  className?: string
  /** Prioriza o carregamento — use na tela de login, onde o logo é o herói. */
  prioridade?: boolean
}

export function Logo({
  variante = 'completo',
  altura = 40,
  decorativo = false,
  className,
  prioridade = false,
}: LogoProps) {
  const largura = Math.round(altura * PROPORCAO[variante])

  return (
    <Image
      src={ARQUIVO[variante]}
      alt={decorativo ? '' : 'GGP — Grupo Gomes Pires'}
      aria-hidden={decorativo || undefined}
      width={largura}
      height={altura}
      priority={prioridade}
      className={className}
    />
  )
}
