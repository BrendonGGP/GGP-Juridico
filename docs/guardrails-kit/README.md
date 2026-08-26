# Kit Universal de Guardrails para Claude

Este pacote reúne instruções, políticas, schemas e testes que podem ser reutilizados em praticamente qualquer projeto com Claude.

## Aviso importante

Prompts reduzem risco, mas não garantem segurança. Regras críticas devem ser aplicadas também no código, no gateway de ferramentas, no banco de dados, no controle de acesso, no sandbox e no processo de aprovação humana.

Regra de arquitetura:

> O modelo propõe. O código valida. A política autoriza. A ferramenta executa. O log registra.

## Onde colocar cada arquivo

### Claude.ai — Projects

1. Crie ou abra um Project.
2. Para uso imediato, cole `00_PROMPT_MESTRE_PRONTO_PARA_COLAR.md` em **Set project instructions / Definir instruções do projeto**. Para uma versão parametrizada, use `01_INSTRUCOES_PROJETO_CLAUDE.md`.
3. Na base de conhecimento do projeto, envie:
   - `05_CONFIGURACAO_PROJETO.yaml`
   - `06_POLITICA_FERRAMENTAS.yaml`
   - `07_POLITICA_MCP.yaml`
   - `08_POLITICA_RAG.md`
   - `15_POLITICA_APROVACAO_HUMANA.yaml`
4. Personalize os campos `{{...}}` antes de usar em produção.

### Claude Team ou Enterprise — instruções da organização

Cole `03_INSTRUCOES_ORGANIZACAO_ATE_3000_CARACTERES.txt` nas instruções da organização. Essa versão é curta e deve coexistir com instruções específicas de cada projeto.

### Claude API

- Use o conteúdo de `02_SYSTEM_PROMPT_API.md` no parâmetro `system`.
- Use `09_SCHEMA_RESPOSTA.json` em `output_config.format` ou um modelo equivalente em Pydantic/Zod.
- Execute o filtro de entrada de `10_PROMPT_FILTRO_ENTRADA.md` com `11_SCHEMA_FILTRO_ENTRADA.json` antes da chamada principal.
- Antes de devolver a resposta, use `13_PROMPT_VERIFICADOR_SAIDA.md` com `14_SCHEMA_VERIFICADOR.json` quando o caso exigir alta factualidade.
- Antes de executar qualquer tool call, aplique `06_POLITICA_FERRAMENTAS.yaml` no código.

### Claude Code

1. Copie `04_CLAUDE.md` para a raiz do repositório com o nome `CLAUDE.md`.
2. Opcionalmente, copie a pasta `claude-code/.claude/commands/` para o projeto.
3. Preencha os comandos de teste, lint, build e os caminhos protegidos.

## Ordem recomendada do fluxo

```text
Entrada do usuário
  -> filtro de entrada
  -> autenticação e autorização
  -> recuperação de fontes autorizadas
  -> Claude com system prompt
  -> proposta de tool call
  -> validação determinística da tool call
  -> aprovação humana quando exigida
  -> execução isolada
  -> filtro do resultado da ferramenta
  -> verificador factual
  -> resposta estruturada
  -> auditoria e métricas
```

## Arquivos do pacote

- `00_PROMPT_MESTRE_PRONTO_PARA_COLAR.md`: versão universal sem campos obrigatórios, pronta para colar.
- `01_INSTRUCOES_PROJETO_CLAUDE.md`: versão parametrizada para Claude Projects.
- `02_SYSTEM_PROMPT_API.md`: versão parametrizada para API.
- `03_INSTRUCOES_ORGANIZACAO_ATE_3000_CARACTERES.txt`: política curta global.
- `04_CLAUDE.md`: instruções seguras para Claude Code.
- `05_CONFIGURACAO_PROJETO.yaml`: variáveis e classificação do projeto.
- `06_POLITICA_FERRAMENTAS.yaml`: autorização de tools com default deny.
- `07_POLITICA_MCP.yaml`: política universal para servidores MCP.
- `08_POLITICA_RAG.md`: regras de recuperação, evidência e citações.
- `09_SCHEMA_RESPOSTA.json`: envelope estruturado de resposta.
- `10_PROMPT_FILTRO_ENTRADA.md`: classificador de entrada não confiável.
- `11_SCHEMA_FILTRO_ENTRADA.json`: schema do classificador.
- `12_PROMPT_FILTRO_RESULTADO_FERRAMENTA.md`: filtro para tool results.
- `13_PROMPT_VERIFICADOR_SAIDA.md`: verificação de claims contra evidências.
- `14_SCHEMA_VERIFICADOR.json`: schema do verificador.
- `15_POLITICA_APROVACAO_HUMANA.yaml`: matriz de aprovação.
- `16_TESTES_RED_TEAM.jsonl`: casos adversariais mínimos.
- `17_CHECKLIST_PRODUCAO.md`: checklist técnico e de governança.
- `18_TEMPLATE_DESCRICAO_TOOL.md`: padrão de descrição de ferramentas.
- `19_PROMPT_INICIALIZACAO_PROJETO.md`: prompt para adaptar o kit a um novo projeto.
- `examples/python_claude_guarded.py`: exemplo de API com filtro e saída estruturada.
- `examples/tool_policy_enforcer.py`: exemplo de autorização fora do LLM.
- `examples/mcp_config.example.json`: configuração ilustrativa de MCP local.
- `examples/promptfoo.example.yaml`: esqueleto de regressão/red team.
- `examples/.env.example`: variáveis esperadas.

## Campos que precisam ser personalizados

Procure por `{{` em todos os arquivos e substitua, no mínimo:

- `{{PROJECT_NAME}}`
- `{{PROJECT_PURPOSE}}`
- `{{DOMAIN}}`
- `{{AUTHORIZED_SOURCES}}`
- `{{PROHIBITED_ACTIONS}}`
- `{{APPROVAL_REQUIRED_ACTIONS}}`
- `{{TENANT_ID}}`
- `{{USER_ROLE}}`
- `{{CURRENT_DATE}}`
- `{{TIMEZONE}}`

## Referências oficiais úteis

- Anthropic Agent Skills: https://github.com/anthropics/skills
- Claude Code: https://github.com/anthropics/claude-code
- MCP reference servers: https://github.com/modelcontextprotocol/servers
- MCP specification and security: https://modelcontextprotocol.io/
- Claude Platform documentation: https://platform.claude.com/docs/

Não considere um MCP ou skill seguro apenas por estar no GitHub. Revise código, dependências, permissões, rede, acesso a arquivos, secrets e comportamento de atualização antes de instalar.
