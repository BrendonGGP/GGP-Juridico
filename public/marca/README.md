# Arquivos da marca

Arte oficial do Grupo Gomes Pires, usada por `components/marca/Logo.tsx`.

## Arquivos

| Arquivo | O que é | Onde aparece |
|---|---|---|
| `ggp-completo.png` | "GGP" + "GRUPO GOMES PIRES" | Sidebar, tela de login |
| `ggp-simbolo.png`  | Só o "P" com o traço horizontal | Favicon |

Ambos: 4800×4800, RGBA, fundo transparente.

## Sobre o formato e o tamanho

São PNG. Funcionam bem porque têm resolução de sobra — o uso maior é 140px
na tela de login, contra 4800px de original. O Next redimensiona e serve em
WebP/AVIF automaticamente, então o peso do arquivo original não chega ao
navegador.

Se um dia houver **SVG oficial**, vale trocar: fica nítido em qualquer
ampliação e é melhor na impressão do Relatório Executivo, que é vetorial.
Para trocar, basta substituir a extensão em `ARQUIVO` no componente e em
`tests/marca.test.ts`.

## A arte é quadrada, com margem embutida

O logo vem centralizado num quadro quadrado, com bastante espaço em volta.
Por isso `altura` no componente se refere ao QUADRO, não ao lettering: em
44px de quadro, a marca em si ocupa por volta de 30px. É o motivo de os
valores de uso parecerem grandes.

Essa margem também já entrega parte da área de proteção que o manual exige.

## Regras do manual que já estão atendidas

- **O texto inferior segue a cor dos "G".** Como a arte oficial traz o texto
  embutido, a regra não pode mais ser violada por engano no código.
- **Área de proteção.** Complementada por `--logo-respiro` em
  `app/globals.css`.

## Não versionar variação improvisada

Recolorir, esticar ou recortar o logo em código viola o manual. Se for
preciso outra variante (fundo escuro, monocromática), peça o arquivo ao
responsável pela marca e adicione aqui como um novo arquivo.
