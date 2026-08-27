# Arquivos da marca

Arte oficial do Grupo Gomes Pires, usada por `components/marca/Logo.tsx`.

## Arquivos

| Arquivo | Cor dos "G" | Usar sobre | Onde aparece hoje |
|---|---|---|---|
| `ggp-escuro.png` | Grafite | Fundo **claro** | Sidebar, login, favicon |
| `ggp-claro.png`  | Branco  | Fundo **escuro** | Reserva |

Ambos: 4800×4800 de moldura, RGBA, fundo transparente.

## A variante é escolhida pelo fundo, não pelo tamanho

Nome de arquivo por tamanho ("completo", "símbolo") não descreve o que
diferencia estas duas artes — elas têm o **mesmo desenho**, mudando só a cor
das letras. Por isso os nomes dizem para que fundo cada uma serve.

**Errar isso faz o logo sumir sem erro visível:** os "G" brancos sobre fundo
claro desaparecem e sobra só o "P" teal, que parece um símbolo isolado de
propósito em vez de um defeito. Já aconteceu; `tests/marca.test.ts` agora
mede a luminância das letras para impedir a repetição.

## O desenho é 2:1, a moldura é quadrada

O arquivo é 4800×4800, mas o logo ocupa só a faixa central (~3952×1950).
Tratar o arquivo como quadrado **estica o desenho**. O componente usa a
proporção real (2,03) e `height: auto`.

No componente, `altura` é a do **desenho**, não da moldura.

## O que ainda falta

**Símbolo isolado** (só o "P" com o traço) para o favicon. Hoje o favicon usa
a marca completa, que em 16px fica ilegível. Se for possível exportar essa
variante, adicione como `ggp-simbolo.png` e ajuste `icons` em
`app/layout.tsx`.

**SVG oficial**, se houver. Fica nítido em qualquer ampliação e é melhor na
impressão do Relatório Executivo, que é vetorial. Para trocar, basta mudar a
extensão em `ARQUIVO` no componente e em `tests/marca.test.ts`.

## Regras do manual que já estão atendidas

- **O texto inferior segue a cor dos "G".** Vem embutido na arte oficial,
  então não pode ser violado por engano no código.
- **Área de proteção.** Complementada por `--logo-respiro` em
  `app/globals.css`.

## Não versionar variação improvisada

Recolorir, esticar ou recortar o logo em código viola o manual. Se precisar
de outra variante, peça o arquivo ao responsável pela marca.
