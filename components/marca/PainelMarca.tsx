/**
 * Painel decorativo da tela de login — os arcos e diagonais da referência.
 *
 * SVG inline, não imagem: escala sem perda, acompanha a paleta por
 * `currentColor` e não custa uma requisição.
 *
 * É puramente ornamental, então `aria-hidden`. Um leitor de tela anunciando
 * "gráfico" aqui só atrasaria quem quer chegar ao campo de e-mail.
 */
export function PainelMarca({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 600 800"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      {/* Arcos concêntricos — o eco do "G" do logotipo. */}
      <g stroke="currentColor" strokeWidth="1.5" opacity="0.35">
        <circle cx="470" cy="150" r="200" />
        <circle cx="470" cy="150" r="300" />
        <circle cx="120" cy="90" r="110" />
        <circle cx="520" cy="620" r="150" />
      </g>

      {/* Diagonais espessas do canto inferior. */}
      <g stroke="currentColor" strokeWidth="26" strokeLinecap="round" opacity="0.18">
        <path d="M-40 780 L170 560" />
        <path d="M60 800 L300 545" />
        <path d="M180 810 L440 530" />
      </g>
    </svg>
  )
}
