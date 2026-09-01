import { z } from 'zod'

/**
 * Configuração do ambiente, validada.
 *
 * Antes disto, `process.env` era lido solto em cada ponto de uso. Dois
 * problemas concretos que isso causava:
 *
 *  1. Um `.env` incompleto só aparecia em runtime, no meio de uma requisição
 *     — em produção, na cara do usuário, e não ao subir o processo.
 *  2. A trava de produção da importação comparava `APP_ENV === 'production'`
 *     com uma string solta. `Production`, `prod` ou a variável ausente
 *     faziam a comparação dar falso e o endpoint ABRIR. Fail-open numa trava
 *     de segurança é exatamente o contrário do que o CLAUDE.md exige.
 *
 * Aqui o ambiente é um enum: valor inválido não passa, e a ausência cai em
 * `development`, que é o modo restritivo.
 *
 * O que NÃO é validado agressivamente: segredos ainda não usados pelo
 * sistema (Anthropic). Exigi-los agora quebraria o CI e o build sem proteger
 * nada — eles entram no schema quando a funcionalidade que os consome existir.
 */

const schema = z.object({
  /**
   * Ambiente de execução. Governa a trava da importação e o rigor dos
   * limites. Ausente ou inválido => development.
   */
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  /**
   * Conexão do runtime (pooler, 6543). Opcional no schema porque `next build`
   * e o CI precisam rodar sem banco; quem exige de fato é `lib/db.ts`, na
   * primeira consulta.
   */
  DATABASE_URL: z.string().url().optional(),

  /**
   * Supabase Auth. Opcionais no schema pelo mesmo motivo do DATABASE_URL: o
   * `next build` e o CI rodam sem segredo nenhum. Quem exige de fato é
   * `lib/auth/cliente.ts`, ao criar o cliente.
   *
   * A ANON_KEY é pública por natureza — vai para o navegador e é protegida
   * pelas políticas do banco, não por sigilo. Já a SERVICE_ROLE_KEY ignora
   * toda política de acesso: ela nunca pode ter o prefixo NEXT_PUBLIC_, que
   * a embutiria no bundle do cliente.
   */
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // --- Limites de ingestão (ver seguranca/configuracao-projeto.yaml) ---
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),
  MAX_LINHAS_PLANILHA: z.coerce.number().int().positive().default(5000),
  TIMEOUT_INGESTAO_SEGUNDOS: z.coerce.number().int().positive().default(300),

  // --- Auditoria ---
  // Só desliga com o literal "false"; qualquer outra coisa mantém ligado.
  AUDIT_LOG_HABILITADO: z
    .string()
    .default('true')
    .transform(v => v !== 'false'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // --- Superfície de LLM (§3.3) ---
  // Entra DESLIGADA. Só liga com o literal "true".
  LLM_SUMARIO_HABILITADO: z
    .string()
    .default('false')
    .transform(v => v === 'true'),
})

export type Config = z.infer<typeof schema>

function carregar(): Config {
  const r = schema.safeParse(process.env)

  if (!r.success) {
    // Só os NOMES das variáveis com problema. O valor nunca é impresso: uma
    // connection string malformada num log é um segredo vazado.
    const campos = r.error.issues.map(i => i.path.join('.')).join(', ')
    throw new Error(
      `Configuração de ambiente inválida: ${campos}. Confira o .env contra o .env.example.`
    )
  }

  return r.data
}

export const config = carregar()

/**
 * Ambiente com dado real. Governa o que é permitido.
 *
 * Escrito como igualdade com o enum já validado, não com string livre: um
 * valor não reconhecido teria falhado no carregamento acima.
 */
export const ehProducao = config.APP_ENV === 'production'
export const ehDesenvolvimento = config.APP_ENV === 'development'

/**
 * Lê uma variável obrigatória no ponto de uso.
 *
 * Existe para separar "o build não precisa disto" de "esta operação precisa":
 * o schema acima deixa os segredos opcionais para o CI rodar sem eles, e aqui
 * a exigência aparece no momento em que a funcionalidade é de fato usada.
 *
 * Nunca imprime o valor — só o nome. Uma chave de serviço num log é um
 * segredo vazado, e log de erro costuma ir mais longe do que se espera.
 */
export function exigir(nome: keyof Config): string {
  const valor = config[nome]
  if (typeof valor !== 'string' || valor.length === 0) {
    throw new Error(
      `${nome} não está definida. Preencha o .env (veja .env.example) e reinicie o servidor.`
    )
  }
  return valor
}

/** Se a autenticação está configurada. Não diz se está funcionando. */
export const authConfigurada =
  Boolean(config.NEXT_PUBLIC_SUPABASE_URL) && Boolean(config.NEXT_PUBLIC_SUPABASE_ANON_KEY)
