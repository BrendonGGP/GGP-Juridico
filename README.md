# GGP-Jurídico

Sistema de Gestão e Indicadores do Jurídico — **Grupo Gomes Pires / Seven**.

Centraliza processos judiciais e acordos, calcula provisionamento de risco por cenário
(Conservador / Realista / Otimista), projeta desembolso (6/12/24 meses) e gera o
Relatório Executivo, atualizado por importação mensal de planilhas.

- **Entrega:** 13/09/2026
- **Stack:** Next.js 15 (App Router) · TypeScript · PostgreSQL (Supabase) · Prisma ·
  SheetJS · Recharts
- **Estado atual:** especificação fechada e fundação de segurança implementada.
  O desenvolvimento da aplicação ainda não começou.

## Estrutura da pasta

```text
GGP-Juridico/
├── CLAUDE.md                    Regras persistentes do repositório (ler primeiro)
├── README.md                    Este arquivo
├── .env.example                 Variáveis de ambiente esperadas
├── .gitignore                   Exclui secrets, planilhas e documentos com dado real
│
├── .claude/
│   ├── commands/                Slash commands do Claude Code
│   │   ├── preflight.md         /preflight — análise de risco antes de editar
│   │   └── security-review.md   /security-review — revisão de segurança do diff
│   └── skills/
│       └── ui-ux-pro-max/       Skill de design (MIT, commit fixado, offline)
│
├── seguranca/                   Políticas EM VIGOR neste projeto
│   ├── README.md                As 6 adaptações do kit, com justificativa
│   ├── configuracao-projeto.yaml
│   ├── politica-aprovacao-humana.yaml
│   ├── politica-llm-sumario-executivo.yaml
│   └── registro-componentes-terceiros.yaml   Auditoria do que veio de fora
│
└── docs/                        Material de referência recebido — NÃO EDITAR
    ├── especificacao/           Especificação e formulários validados com o Jurídico
    │   ├── especificacao-projeto.docx          ← fonte de verdade do negócio
    │   ├── formulario-pendencias-juridico*.docx        (1ª rodada)
    │   └── formulario-pendencias-juridico-rodada2*.docx (2ª rodada)
    └── guardrails-kit/          Kit Universal de Guardrails, original e íntegro
        ├── 00_ … 15_            Prompts, políticas e schemas
        ├── claude-code-commands/
        └── examples/
```

Quando o desenvolvimento começar (Fase 1), entram `app/`, `lib/`, `components/`,
`prisma/`, `tests/` e `scripts/` — os diretórios autorizados para escrita no
`CLAUDE.md`. Planilhas reais para validação ficam em `dados-reais/`, que nunca é
versionado.

## Por onde começar

| Se você quer… | Leia |
|---|---|
| Entender a regra de negócio | `docs/especificacao/especificacao-projeto.docx` |
| Trabalhar no código | [CLAUDE.md](CLAUDE.md) — em especial as **regras de domínio invioláveis** |
| Entender as decisões de segurança | [seguranca/README.md](seguranca/README.md) |
| Mexer no Sumário Executivo (§3.3) | [seguranca/politica-llm-sumario-executivo.yaml](seguranca/politica-llm-sumario-executivo.yaml) |

## Regras que definem o produto

Do `CLAUDE.md`, as que mais causam erro silencioso se ignoradas:

1. **Nunca somar `Valor do Acordo` com `Valor total da condenação`** — o acordo
   substitui a condenação. Somar infla o resultado em até 2x.
2. **`Êxito do processo` é curado manualmente — nunca recalcular por fórmula.**
3. **Nunca ler coluna por nome fixo** — os nomes mudam entre os meses. Resolver por
   tabela de apelidos; coluna desconhecida vai para a tela de validação.
4. **Parcelas de acordo usam chave composta (processo + mês)** — sem isso, cada
   reenvio mensal duplica parcelas e infla a projeção de desembolso.
5. **Cada importação é um snapshot versionado** — o histórico nunca é sobrescrito.

## Segurança

Dado jurídico e financeiro sensível de terceiros. Em resumo: perfis com fail-closed,
mascaramento de PII, logs sem dado pessoal ou valor por processo, importação mensal
com dry-run e rollback, e nenhum dado bruto chegando a API de LLM. Os detalhes e o
raciocínio por trás de cada decisão estão em [seguranca/README.md](seguranca/README.md).

## Pendências com o Jurídico

1. Prazo de retenção de dados (proposta registrada, aguardando confirmação).
2. Causa dos 5 acordos órfãos — fichas `N010604.00`, `N013295.00`, `N025244.00`,
   `N011936.00`, `N011861.00`.
3. Envio do relatório para `juridico@grupogomespires.com.br`: e-mail automático ou
   download manual em PDF?
