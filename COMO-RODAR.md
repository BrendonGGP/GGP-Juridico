# Como rodar o sistema na sua máquina

Este guia cobre o servidor de desenvolvimento — o `localhost`, que roda no seu
computador e não fica acessível pela internet.

## Antes da primeira vez

**1. Node.js 24 ou superior**

```bash
node -v
```

Se der erro ou mostrar versão menor que 24, instale em https://nodejs.org
(escolha a versão LTS).

**2. Instalar as dependências**

Na pasta do projeto (`C:\dev\ggp-juridico`):

```bash
npm ci
```

Use `npm ci`, não `npm install`: ele respeita o `package-lock.json` exatamente,
instalando as mesmas versões que foram testadas.

**3. Criar o arquivo `.env`**

Copie o modelo e preencha:

```bash
cp .env.example .env
```

O mínimo para as telas funcionarem é `DATABASE_URL`. As credenciais do Supabase
estão em **Project Settings → Database → Connection string**.

> O `.env` nunca vai para o GitHub — ele está no `.gitignore` de propósito.
> Se você formatar a máquina sem copiá-lo, precisará preenchê-lo de novo.

**4. Gerar o cliente do banco**

```bash
npm run db:generate
```

Só é necessário na primeira vez, ou quando `prisma/schema.prisma` mudar.

## Rodando

```bash
npm run dev
```

Espere a mensagem `✓ Ready`. O endereço aparece logo acima:

```
▲ Next.js 16.3.3 (Turbopack)
- Local:  http://localhost:3000
✓ Ready in 598ms
```

Abra **http://localhost:3000** no navegador.

### As telas

| Tela | Endereço |
|---|---|
| Visão Executiva | http://localhost:3000 |
| Dashboard | http://localhost:3000/dashboard |
| Relatório Executivo | http://localhost:3000/relatorio |
| Importação mensal | http://localhost:3000/importacao |
| Login | http://localhost:3000/login |

### Enquanto roda

O terminal fica ocupado mostrando os acessos — é o normal. Alterações no código
aparecem no navegador automaticamente, sem reiniciar.

**Para parar:** `Ctrl+C` no terminal.

## Quando algo não funciona

### "A porta 3000 está em uso"

O Next avisa e sobe em outra porta:

```
⚠ Port 3000 is in use, using available port 3001 instead.
- Local:  http://localhost:3001
```

**Leia o endereço que ele imprime** em vez de digitar 3000 de memória. Já
aconteceu de abrirmos a 3000 e encontrarmos outro sistema rodando ali, achando
que era este.

Para descobrir quem ocupa a porta:

```bash
netstat -ano | grep LISTENING | grep :3000
```

O último número é o PID. Para encerrar: `taskkill //PID <numero> //F`

### "DATABASE_URL ausente"

Falta o `.env`, ou ele não tem a variável preenchida. Veja o passo 3.

### As telas dizem "Nenhuma importação concluída"

**Isso não é erro.** O banco está vazio porque nenhuma planilha foi gravada
ainda — só rodamos análises que desfazem tudo ao final.

A tela se recusa a mostrar zeros de propósito: um painel zerado se confunde
com uma carteira sem processos, e num relatório de provisionamento essa
confusão levaria a decisão errada.

A tela de **Importação** funciona por completo — envie as planilhas e você verá
a análise real. O botão de confirmar ainda não grava, porque falta a
autenticação: gravar sem saber *quem* gravou quebraria o log de auditoria.

### Erro estranho depois de trocar de branch

As dependências ou o cliente do banco podem estar desatualizados:

```bash
npm ci
npm run db:generate
```

### A página não carrega, mas o terminal não mostra erro

Confira se você está usando `http://` e não `https://`. O servidor de
desenvolvimento não usa HTTPS.

## Outros comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Roda os testes |
| `npm run lint` | Verifica o estilo do código |
| `npm run typecheck` | Verifica os tipos |
| `npm run build` | Compila para produção |
| `npm run db:studio` | Abre uma interface visual do banco |

## O que este guia NÃO cobre

Este é o servidor **local**. Ele roda só na sua máquina e some quando você
fecha o terminal.

Colocar o sistema no ar para outras pessoas acessarem é **deploy**, coisa
diferente: envolve hospedagem, domínio, variáveis de ambiente no servidor e —
principalmente — a autenticação, que ainda não existe. Hoje qualquer pessoa
com o endereço veria todos os dados sem senha.

Deploy é operação que exige aprovação explícita (ver `CLAUDE.md`).

### Um detalhe sobre a rede local

O Next também imprime um endereço `Network`, como `http://192.168.24.202:3000`.
Ele funciona para outros aparelhos no **mesmo Wi-Fi** — útil para ver o layout
no celular.

Mas lembre: **não há senha ainda**. Enquanto a autenticação não existir, evite
usar esse endereço em rede compartilhada, porque o sistema mostra dado jurídico
de terceiros.
