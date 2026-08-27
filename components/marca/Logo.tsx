import Image from 'next/image'

/**
 * Logotipo GGP — arquivo oficial da marca.
 *
 * Usa o desenho real, não uma aproximação tipográfica: o lettering do GGP é
 * customizado (o traço horizontal atravessa as três letras) e nenhuma fonte
 * reproduz isso.
 *
 * A variante é escolhida pelo FUNDO, não por tamanho:
 *
 *   `escuro`  G em grafite  -> use sobre fundo CLARO
 *   `claro`   G em branco   -> use sobre fundo ESCURO
 *
 * Errar isso faz o logo sumir: os "G" brancos sobre fundo claro desaparecem e
 * sobra só o "P" teal, que parece um símbolo isolado em vez de um defeito.
 *
 * Regras do manual atendidas pelo próprio arquivo:
 *
 *  1. "O texto inferior deve SEMPRE seguir a mesma cor das letras G's."
 *     O texto vem embutido na arte oficial, então a regra não pode ser
 *     violada por engano no código.
 *  2. Área de proteção — complementada por `--logo-respiro`.
 *
 * Acessibilidade: quando o logo apenas repete um texto já visível ao lado,
 * passe `decorativo` — senão o leitor de tela anuncia a marca duas vezes.
 */

/** Sobre que tipo de fundo o logo vai aparecer. */
export type FundoLogo = 'claro' | 'escuro'

const ARQUIVO: Record<FundoLogo, string> = {
  // Fundo claro pede o logo de letras escuras, e vice-versa.
  claro: '/marca/ggp-escuro.png',
  escuro: '/marca/ggp-claro.png',
}

/**
 * O desenho é 2:1 — quase o dobro de largura que de altura.
 *
 * A moldura do arquivo é quadrada (4800×4800), mas o logo ocupa só a faixa
 * central (~3952×1950). Tratar o arquivo como quadrado esticava o desenho.
 * O `object-contain` abaixo respeita a proporção real dentro do quadro.
 */
const PROPORCAO = 2.03

interface LogoProps {
  /** Tipo de fundo onde o logo será colocado. Padrão: fundo claro. */
  fundo?: FundoLogo
  /** Altura do DESENHO em pixels. A largura acompanha a proporção 2:1. */
  altura?: number
  /** Marca o logo como ornamento, quando o nome já aparece em texto ao lado. */
  decorativo?: boolean
  className?: string
  /** Prioriza o carregamento — use na tela de login, onde o logo é o herói. */
  prioridade?: boolean
}

export function Logo({
  fundo = 'claro',
  altura = 40,
  decorativo = false,
  className,
  prioridade = false,
}: LogoProps) {
  const largura = Math.round(altura * PROPORCAO)

  return (
    <Image
      src={ARQUIVO[fundo]}
      alt={decorativo ? '' : 'GGP — Grupo Gomes Pires'}
      aria-hidden={decorativo || undefined}
      width={largura}
      height={altura}
      priority={prioridade}
      // A arte tem margem embutida na moldura quadrada; `object-contain`
      // encaixa o desenho sem distorcer.
      style={{ width: largura, height: 'auto' }}
      className={className}
    />
  )
}
