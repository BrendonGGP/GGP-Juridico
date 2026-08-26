# Segurança — GGP-Jurídico

Esta pasta contém o **Kit Universal de Guardrails adaptado a este projeto**. Os arquivos
originais do kit estão preservados em [`../docs/guardrails-kit/`](../docs/guardrails-kit/)
como material de referência e **não devem ser editados** — quando este README cita um
arquivo `00_`–`15_`, é lá que ele está.

## Por que o kit precisou ser adaptado

O kit foi desenhado para **aplicações de IA/agênticas**: filtro de entrada, política de
tools, MCP, RAG, verificador factual e envelope de resposta. O GGP-Jurídico é
**majoritariamente determinístico** — ingestão de Excel, cálculo de provisionamento e
dashboard. Não há tools expostas a um modelo, não há MCP e não há RAG.

A regra de arquitetura do próprio kit explica o encaixe:

> *"O modelo propõe. O código valida. A política autoriza. A ferramenta executa. O log registra."*

Neste projeto **o código faz tudo**, com uma única exceção: o Sumário Executivo (§3.3 da
especificação). O kit foi então aplicado em duas frentes distintas.

## Frente 1 — Segurança de aplicação convencional

Vale para o sistema inteiro e está em:

| Arquivo em uso | Origem em `docs/guardrails-kit/` | Conteúdo |
|---|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | `04_CLAUDE.md` | Regras do repositório, regras de domínio invioláveis, classificação de dados, operações proibidas |
| [`configuracao-projeto.yaml`](configuracao-projeto.yaml) | `05_CONFIGURACAO_PROJETO.yaml` | Perfis, escopo, fontes autorizadas, modelo de risco, política de dados sensíveis, limites |
| [`politica-aprovacao-humana.yaml`](politica-aprovacao-humana.yaml) | `15_POLITICA_APROVACAO_HUMANA.yaml` | Matriz de aprovação por ação |
| [`../.claude/commands/preflight.md`](../.claude/commands/preflight.md) | `claude-code-commands/preflight.md` | `/preflight` — análise antes de editar |
| [`../.claude/commands/security-review.md`](../.claude/commands/security-review.md) | `claude-code-commands/security-review.md` | `/security-review` — revisão do diff |

## Frente 2 — A única superfície de LLM

[`politica-llm-sumario-executivo.yaml`](politica-llm-sumario-executivo.yaml) governa o
§3.3 da especificação. Aqui o kit se aplica **inteiro** e resolve dois riscos reais: dado
jurídico sensível vazando para uma API externa, e um texto gerado que inventa números.

Desenho adotado — **o LLM redige, o código calcula**:

1. O backend calcula todos os agregados deterministicamente.
2. Uma allowlist estrita monta o payload. Qualquer campo da denylist aborta a chamada.
3. O modelo redige, devolvendo o envelope de `09_SCHEMA_RESPOSTA.json`.
4. O verificador (`13_` + `14_`) confere cada claim contra os agregados.
5. Claim sem suporte é **removida**, nunca corrigida pelo modelo.
6. Falha, timeout ou reprovação → **fallback determinístico por template**.

O fallback é construído primeiro. A camada de LLM é aditiva e entra desligada
(`LLM_SUMARIO_HABILITADO=false`).

## Adaptações feitas, com justificativa

Cada desvio do kit está registrado aqui. Nenhum tornou a política **mais permissiva em
segurança** — as mudanças ou traduzem um conceito para a realidade do projeto, ou
substituem um controle inviável por outro equivalente.

### 1. `bulk_update: L4 / dual` → importação mensal como L3 / single

**Conflito.** A importação mensal é tecnicamente um bulk update de ~900 registros. O kit
exigiria 2 aprovadores humanos distintos. O sistema tem 2 usuários diretos (Jaquelline e
Leandro) e a importação é a operação central e recorrente do produto — dual approval o
travaria.

**Adaptação.** Reclassificada como L3/single, com controles compensatórios obrigatórios
que o próprio kit já exige em `batch_actions`: dry-run, preview com contagem e amostra,
relatório de divergências antes de gravar, snapshot imutável, rollback disponível, chave
de idempotência e transação única. O hash do arquivo entra na aprovação — arquivo
diferente invalida a aprovação anterior.

**Efeito líquido:** menos fricção humana, mais reversibilidade técnica.

### 2. `max_records_per_read: 100` / `max_records_per_write: 1` escopados

**Conflito.** São limites para tool calls de LLM. Aplicados à camada de dados, o sistema
não conseguiria ler os ~900 processos nem gravar um lote de importação.

**Adaptação.** Mantidos integralmente, mas com `aplica_se_a: superficie_llm_apenas`. A
camada de dados ganhou o bloco separado `limits_aplicacao`, com limites próprios e
apropriados (tamanho de upload, nº de abas, nº de linhas, timeout de ingestão).

### 3. `tenant_isolation: true` → escopo por carteira

**Conflito.** O kit assume multi-tenant. Este é um sistema single-tenant (um grupo
empresarial, 2 usuários). Construir máquina de multi-tenancy seria complexidade sem
proteção correspondente.

**Adaptação.** "Tenant" foi traduzido em **carteira/cliente** (~11 clientes distintos),
usado como filtro de linha ligado ao perfil. `carteira_scoping_required: true`. O
incidente `cross_tenant_attempt` virou `cross_carteira_attempt`, mantendo
`block_and_alert`.

### 4. "Desenvolvimento deve usar dados sintéticos" → exceção controlada

**Conflito.** A Fase 6 do plano exige conferir os números calculados contra as planilhas
reais de julho/2026. Sem isso, não há como afirmar que o provisionamento está correto.

**Adaptação.** Dados sintéticos continuam sendo o padrão — inclusive um gerador que
reproduz as anomalias reais. A validação com planilha real é permitida **apenas** em
máquina local, com os arquivos em `dados-reais/` (no `.gitignore`), sem commit, sem log
de conteúdo, sem sair da máquina, e nunca em staging, produção, CI ou fixture.

### 5. `retention_days` — pendente de decisão de negócio

**Conflito.** O campo veio em branco no kit, e aqui não é decisão técnica: os snapshots
históricos **são o produto** (§3.6 da especificação). Retenção curta destruiria o valor.

**Adaptação.** Política separada por tipo de dado, com proposta e status `PENDENTE`:
snapshots e agregados indefinidos; arquivos `.xlsx` crus descartados após 90 dias
(a informação já foi extraída); auditoria 365 dias; log de aplicação 30 dias.
**Confirmar com a Jaquelline.**

### 6. Filtro de entrada, política de MCP e RAG — não aplicados

`10_`/`11_` (filtro de entrada), `07_` (MCP) e `08_` (RAG) não têm superfície
correspondente neste sistema: não há entrada livre de usuário chegando a um modelo, não
há servidor MCP e não há recuperação semântica. Ficam **arquivados como referência** e
passam a valer automaticamente se alguma dessas superfícies for criada.

O princípio central do `08_POLITICA_RAG.md` — *quote first*, responder só a partir de
trechos recuperados — foi preservado na frente 2 na forma da regra "o modelo só recebe
agregados e só pode afirmar o que está neles".

## Arquivos do kit ausentes

O [`README.md` original do kit](../docs/guardrails-kit/README.md) lista seis arquivos que
não vieram na pasta:
`01_INSTRUCOES_PROJETO_CLAUDE.md`, `16_TESTES_RED_TEAM.jsonl`,
`17_CHECKLIST_PRODUCAO.md`, `18_TEMPLATE_DESCRICAO_TOOL.md`,
`19_PROMPT_INICIALIZACAO_PROJETO.md` e `examples/.env.example`.

Consequência prática: apenas o **`17_CHECKLIST_PRODUCAO.md`** faz falta. Será escrito
sob medida para este projeto na Fase 6, cobrindo go-live: desativação de `adm@adm.com`,
rotação de secrets, verificação de logs sem PII, confirmação de retenção e teste de
rollback de snapshot.

## Pendências para o Jurídico

1. **Retenção de dados** — confirmar os prazos propostos na seção 5 acima.
2. **Acordos órfãos** — 5 fichas com parcela ativa que não constam no relatório geral do
   mesmo mês (`N010604.00`, `N013295.00`, `N025244.00`, `N011936.00`, `N011861.00`).
   O sistema registra em log e não bloqueia a importação, mas a causa segue sem resposta
   do escritório externo.
3. **Envio do relatório** para `juridico@grupogomespires.com.br` — confirmar se por
   e-mail automático (L3, exige aprovação e allowlist) ou download manual em PDF.
