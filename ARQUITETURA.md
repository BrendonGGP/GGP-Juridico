# Arquitetura

Como o código está organizado e por quê. Para as regras de negócio, ver
[CLAUDE.md](CLAUDE.md); para o fluxo de contribuição, [CONTRIBUINDO.md](CONTRIBUINDO.md).

## A ideia central

O dado atravessa quatro camadas, e cada uma só conhece a seguinte:

```
planilha .xlsx  ou  banco
        |
        v
   ADAPTADORES          lib/painel/de-planilha.ts
   traduzem para        lib/painel/de-banco.ts
   um tipo comum
        |
        v
   MOTOR DE CÁLCULO     lib/calculo/*  +  lib/painel/montar.ts
   não sabe a origem
        |
        v
   TELAS                app/*  +  components/*
   não calculam nada
```

**A regra que sustenta tudo:** o cálculo não sabe de onde o dado veio. Banco e
planilha viram `ProcessoParaCalculo` (em `lib/painel/tipos.ts`) e, daí para a
frente, o caminho é um só.

Isso não é preferência estética. Antes, a sequência de cálculo estava escrita
três vezes — na leitura do banco, num script de conferência e num teste. Se uma
cópia divergisse, o teste ficaria verde validando um cálculo que a tela não faz.
Num sistema que projeta passivo de milhões, era a duplicação mais cara que havia.

## Diretórios

| Caminho | Papel |
|---|---|
| `lib/ingestao/` | Ler .xlsx, normalizar célula, consolidar, gravar |
| `lib/calculo/` | **Único** lugar autorizado a interpretar valor |
| `lib/painel/` | Adaptadores + montagem dos dados das telas |
| `lib/formato.ts` | Formatação pt-BR (moeda, data, número) |
| `lib/config.ts` | Ambiente validado na inicialização |
| `lib/db.ts` | Cliente Prisma (criação preguiçosa) |
| `app/` | Rotas e telas |
| `components/` | UI reutilizável |
| `scripts/` | Conferência manual contra a base real |
| `tests/` | Testes; `tests/apoio/` tem o que é compartilhado |

## Decisões que não são óbvias

**`lib/calculo` não importa Prisma nem React.** É o que permite rodar o motor
num script, num teste e no servidor sem arrastar banco ou UI junto.

**Os scripts não refazem lógica.** Usam `lib/ingestao/pipeline.ts` e
`lib/painel/montar.ts`, os mesmos da aplicação. Um script de conferência que
reimplementa o pipeline confere a si mesmo, não o sistema.

**O cliente Prisma é criado preguiçosamente** (`lib/db.ts`). O `next build`
importa as páginas para analisá-las, sem consultar nada; criar o cliente no
import faria o build exigir `DATABASE_URL` — e exigir credencial para compilar
significaria dar acesso ao banco ao CI, que não precisa e não deve ter.

**A configuração é validada ao carregar** (`lib/config.ts`), com `APP_ENV` como
enum. A versão anterior comparava `APP_ENV === 'production'` com string solta:
`Production` ou a variável ausente davam falso e **abriam** o endpoint de
importação. Agora a trava é `!ehDesenvolvimento` — fail-closed.

**A formatação vive em `lib/formato.ts`.** Antes, `mesPorExtenso` era importada
de `app/relatorio/Relatorio.tsx` por outras três páginas: um componente de tela
virara biblioteca das demais.

## Testes

| Arquivo | O que protege |
|---|---|
| `tests/caracterizacao.test.ts` | **Trava os números** da base real de julho |
| `tests/telas.test.tsx` | As telas renderizam com 836 processos |
| `tests/config.test.ts` | A trava de ambiente fecha, inclusive com grafia errada |
| demais | Regras de domínio, normalização, cálculo |

O teste de **caracterização** merece destaque: ele não valida se os números
estão certos (isso foi conferido à mão contra a planilha), valida que eles
**não mudam**. É o que torna refatoração segura aqui.

Se um número dele mudar, **pare e investigue**. Nunca atualize o valor esperado
para o teste passar — foi exatamente para impedir isso que ele existe.

## Rodando localmente

```bash
npm run dev        # aplicação
npm test           # 237 testes
npm run lint
npm run typecheck
npm run build
```

Os testes que dependem de `dados-reais/` se declaram **pulados** quando a pasta
não existe — ela é local e gitignored, e nunca vai ao CI.

## Conferência contra a base real

```bash
node --experimental-strip-types scripts/testar-calculos.ts       # motor completo
node --experimental-strip-types scripts/testar-consolidacao.ts   # pipeline de leitura
node --experimental-strip-types scripts/testar-painel.ts         # camada de dados
```

Exigem as planilhas em `dados-reais/`. Nenhum deles grava: o que toca o banco
usa `dryRun` com rollback.
