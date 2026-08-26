# Telas do Stitch — GGP Executive Dashboard Redesign

Projeto Stitch: `14209225900592966252`
(https://stitch.withgoogle.com/projects/14209225900592966252 — exige login Google)

## O que colocar aqui

Para cada uma das 5 telas, exporte do Stitch e salve com o ID no nome:

| # | ID da tela | Arquivos esperados |
|---|---|---|
| 1 | `ee89ed78bf6d4da6828a5b060e21fd9c` | `tela-1-ee89ed78.html` · `tela-1-ee89ed78.png` |
| 2 | `7bab2f55d43f4206b593ba275df051df` | `tela-2-7bab2f55.html` · `tela-2-7bab2f55.png` |
| 3 | `e6fe7790890c4df49aa27a7930e6bad1` | `tela-3-e6fe7790.html` · `tela-3-e6fe7790.png` |
| 4 | `2ea6c1202bec4dbf86b3b637dc3aa470` | `tela-4-2ea6c120.html` · `tela-4-2ea6c120.png` |
| 5 | `37a7adc38c3d4b25b13ddbd8a6d5d8f2` | `tela-5-37a7adc3.html` · `tela-5-37a7adc3.png` |

No Stitch, por tela: **Copy code** (HTML/Tailwind) e a exportação de imagem.
Só o código já basta para começar — a imagem ajuda a conferir a intenção visual.

## Atenção — dado sensível

Se alguma tela contiver dado real de processo (nome de parte, número do processo,
placa, valor por processo), **avise antes de commitar**. Estas telas são mockups de
interface; o conteúdo deve ser fictício. Ver a classificação de dados no
[CLAUDE.md](../../../CLAUDE.md).

## O que será feito com isso

1. Mapear cada tela contra as seções da especificação (Visão Executiva, Dashboard,
   Relatório Executivo).
2. Passar pela skill `ui-ux-pro-max`: contraste 4.5:1, foco visível, alvo de toque
   44×44, `reduced-motion`, e as diretrizes de gráfico (não usar cor como único
   portador de significado).
3. Apontar divergências entre o desenho e o que os dados reais exigem — antes de
   virar código.

Divergência já antecipada: o **Top de processos são duas listas independentes**
(Top 20 por valor + lista completa de Trabalhista/IDPJ sem limite). Se o redesign
trouxer uma lista única, é o primeiro ponto a corrigir.
