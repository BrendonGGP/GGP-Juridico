# Como o trabalho entra neste repositório

Regra única: **nada vai direto para a `main`.** Toda mudança passa por uma
branch e por um Pull Request, que só é mesclado depois de aprovação.

Isso existe porque o sistema calcula provisionamento de risco a partir de
dado jurídico de terceiros. Um número errado aqui vira decisão errada de
diretoria, e o PR é o ponto onde alguém olha antes disso acontecer.

## O fluxo

1. **Branch a partir da `main`**

   ```bash
   git checkout main
   git pull
   git checkout -b nome-da-branch
   ```

   Nomes por assunto, não por pessoa: `fase-6-exportacao`,
   `corrige-projecao-24-meses`, `autenticacao`.

2. **Commits pequenos, com o porquê no corpo da mensagem.**
   O título diz o que mudou; o corpo diz por que era necessário e o que foi
   verificado. Daqui a seis meses o "porquê" é a única parte que não dá para
   reconstruir lendo o diff.

3. **Antes de abrir o PR, rode as verificações:**

   ```bash
   npm test          # 205 testes
   npm run lint
   npx tsc --noEmit
   npm run build
   ```

   Se algo falhar, o PR não está pronto. Não silencie teste nem warning para
   obter saída verde.

4. **Push e abertura do PR**

   ```bash
   git push -u origin nome-da-branch
   ```

   O GitHub devolve o link do PR no próprio output.

5. **Aprovação e merge.** Quem aprova confere o que está descrito abaixo.

## O que revisar antes de aprovar

- **As 10 regras de domínio do `CLAUDE.md` continuam válidas?** Em especial:
  acordo e condenação nunca somados; `Êxito do processo` nunca recalculado;
  coluna nunca lida por nome fixo; parcela sempre com UPSERT por chave
  composta; snapshot nunca sobrescrito.
- **Nenhum número novo sem conferência contra a fonte.** Cálculo de
  provisionamento, KPI ou projeção precisa ter sido comparado com a planilha,
  não só ter teste passando.
- **Nenhum dado pessoal ou financeiro por processo** em log, fixture, mensagem
  de erro ou resposta de API.
- **Nenhum segredo.** `.env` e `dados-reais/` são gitignored e devem continuar
  fora do histórico.
- **O resumo do PR é fiel ao diff** — inclusive sobre o que ficou de fora ou
  não foi verificado.

## Operações que exigem aprovação explícita

Estão listadas no `CLAUDE.md` e valem também aqui: migração destrutiva,
sobrescrever snapshot já gravado, deploy, mudança de autenticação ou
autorização, envio de e-mail ou publicação externa, e qualquer alteração em
`.env`, `prisma/migrations/`, `seguranca/`, `dados-reais/`, `CLAUDE.md` ou
`docs/`.

Aprovar o PR não substitui essas aprovações — são decisões separadas.

## Sobre `dados-reais/`

A pasta é local e gitignored. As planilhas do escritório externo nunca entram
no repositório, nem em fixture, nem em anexo de issue. Os testes que dependem
delas se declaram pulados quando a pasta não existe, em vez de falhar.
