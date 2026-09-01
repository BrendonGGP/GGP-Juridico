# Passo 1 — Inserir as chaves do Supabase

Este documento é temporário: pode ser apagado depois que a autenticação
estiver funcionando.

**Tempo estimado:** 5 minutos.

---

## Antes de começar

As três linhas do Supabase **ainda não existem** no seu `.env` — você vai
adicioná-las ao final do arquivo. Elas existem apenas no `.env.example`, que é
o modelo.

O arquivo fica em:

```
C:\dev\ggp-juridico\.env
```

> **Nunca me mande as chaves por mensagem.** Cole direto no arquivo — eu leio
> de lá. Chave colada numa conversa é chave que precisa ser trocada.

---

## 1. Abrir a página das chaves

<https://supabase.com/dashboard/project/tfxfewrmwlcxdttjjlio/settings/api>

Se pedir login, use a conta que criou o banco.

Essa página tem três informações que interessam:

| O que aparece na tela | O que é |
|---|---|
| **Project URL** | Endereço do seu projeto. Começa com `https://` |
| **anon public** | Chave pública. Vai para o navegador |
| **service_role** | Chave de administrador. Fica escondida até você clicar em **Reveal** |

---

## 2. Adicionar as três linhas ao `.env`

Abra `C:\dev\ggp-juridico\.env` no editor, vá até o **final do arquivo** e cole
este bloco:

```
# --- Supabase Auth ---
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Agora preencha cada uma, copiando do painel do Supabase:

| Cole em… | O valor de… |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL=` | **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY=` | **anon public** |
| `SUPABASE_SERVICE_ROLE_KEY=` | **service_role** (clique em *Reveal* antes) |

### Como colar

- Cole **logo depois do `=`**, sem espaço
- **Sem aspas**
- Cada chave em **uma linha só** — são textos longos, mas não podem ser
  quebrados

Certo:

```
NEXT_PUBLIC_SUPABASE_URL=https://tfxfewrmwlcxdttjjlio.supabase.co
```

Errado:

```
NEXT_PUBLIC_SUPABASE_URL = "https://..."     ← espaços e aspas
NEXT_PUBLIC_SUPABASE_URL=https://tfxfe
wrmwlcxdttjjlio.supabase.co                  ← quebrada em duas linhas
```

**Salve o arquivo** (`Ctrl+S`).

---

## 3. Reiniciar o servidor

O `.env` é lido só quando o servidor sobe. Sem reiniciar, nada muda.

No terminal onde ele está rodando: `Ctrl+C` e depois `npm run dev`.

---

## 4. Conferir (opcional)

Se quiser checar antes de me avisar, rode no terminal:

```bash
node --experimental-strip-types scripts/verificar-chaves.ts
```

Ele diz quais chaves foram reconhecidas e aponta erro de colagem — aspas,
espaço sobrando, URL incompleta. **Nunca imprime o valor das chaves**, só o
tamanho.

Saída esperada quando está tudo certo:

```
ok       NEXT_PUBLIC_SUPABASE_URL (40 caracteres)
ok       NEXT_PUBLIC_SUPABASE_ANON_KEY (208 caracteres)
ok       SUPABASE_SERVICE_ROLE_KEY (219 caracteres)

Tudo certo. Reinicie o servidor se ainda não reiniciou.
```

---

## Pronto. Me avise.

Eu confiro do meu lado e sigo para os próximos passos.

---

# O que muda depois disso

**O sistema fecha.** Hoje ele roda aberto porque não há autenticação
configurada. Assim que as chaves entrarem, `/dashboard`, `/relatorio` e
`/importacao` passam a exigir login.

E ninguém consegue entrar ainda — inclusive você. Isso é esperado: a criação do
seu usuário é o Passo 3, e o perfil de administrador eu configuro depois.

Se precisar ver as telas antes disso, me diga que eu removo as chaves
temporariamente.

---

# Por que a `service_role` é diferente

As duas primeiras chaves são públicas por natureza: a `anon` vai para o
navegador e é protegida pelas regras de acesso do banco, não por sigilo.

A **`service_role` ignora todas essas regras**. Com ela, uma consulta lê e
escreve qualquer linha de qualquer tabela, sem checagem.

Por isso ela:

- **não** tem o prefixo `NEXT_PUBLIC_` — esse prefixo embutiria a chave no
  código que vai para o navegador
- só é usada em operação administrativa deliberada, como convidar um usuário
- nunca aparece em log, mensagem de erro ou resposta de API

O `.env` está no `.gitignore`, então nada disso vai para o GitHub.

---

# Se algo der errado

**"Configuração de ambiente inválida: NEXT_PUBLIC_SUPABASE_URL"**
A URL não é um endereço válido. Confira se está completa, começando com
`https://` e sem espaço antes ou depois.

**A tela de login continua dizendo "autenticação ainda não está configurada"**
O servidor não foi reiniciado, ou uma das duas primeiras linhas está vazia.

**Não encontro a página no Supabase**
No menu lateral: **Project Settings** (engrenagem) → **API**.

**Não sei se colei certo**
Me avise. Eu verifico e digo o que está faltando — sem ver o conteúdo das
chaves.
