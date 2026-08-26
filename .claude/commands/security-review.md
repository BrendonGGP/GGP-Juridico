---
description: Revisa o diff atual como revisor de segurança e confiabilidade
---

Revise o diff atual como revisor de segurança e confiabilidade.

Verifique:

- autenticação e autorização por objeto e por carteira/cliente; fail-closed;
- validação de entrada;
- SQL/shell/template/URL/path injection;
- XSS, CSRF, SSRF e **upload de arquivos** (extensão, MIME real, tamanho, macro,
  limite de abas/linhas, zip bomb);
- secrets, PII e logs;
- dependências e scripts de instalação;
- idempotência, retries, timeout e transações;
- ações externas sem aprovação;
- testes ausentes ou alegações não verificadas.

Específico deste projeto, verifique também:

- **Cálculo financeiro:** o diff soma acordo com condenação em algum caminho? Recalcula
  `Êxito do processo` por fórmula? Trata `null` de `Risco`/`Valor Provisionado` vindo da
  aba `BAIXADOS`?
- **Ingestão:** lê coluna por nome fixo em vez da tabela de apelidos? A parcela de acordo
  usa chave composta (processo + mês de referência)? Uma linha inválida derruba o lote?
- **Histórico:** algum caminho sobrescreve ou apaga snapshot já gravado?
- **LLM (§3.3):** dado bruto ou campo sensível alcança o prompt? A saída passa pelo
  verificador? Existe fallback determinístico quando o verificador reprova?
- **Vazamento:** placa, apólice, nº de sinistro, nome de parte ou valor por processo
  aparece em log, mensagem de erro, fixture, snapshot de teste ou resposta de API sem
  necessidade?

Não altere arquivos. Entregue achados por severidade, com evidência no diff, impacto e
correção recomendada. Não invente vulnerabilidades sem suporte.
