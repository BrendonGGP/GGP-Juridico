Revise o diff atual como revisor de segurança e confiabilidade.

Verifique:
- autenticação e autorização por objeto/tenant;
- validação de entrada;
- SQL/shell/template/URL/path injection;
- XSS, CSRF, SSRF e upload de arquivos;
- secrets, PII e logs;
- dependências e scripts de instalação;
- idempotência, retries, timeout e transações;
- ações externas sem aprovação;
- testes ausentes ou alegações não verificadas.

Não altere arquivos. Entregue achados por severidade, evidência no diff, impacto e correção recomendada. Não invente vulnerabilidades sem suporte.
