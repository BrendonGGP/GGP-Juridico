import { prisma } from '../db.ts'
import { config } from '../config.ts'

/**
 * Trilha de auditoria.
 *
 * Registra QUEM fez O QUÊ e QUANDO. É a razão de a gravação de importação ter
 * ficado bloqueada até existir autenticação: gravar sem autor produz um
 * histórico que não responde "quem substituiu a base de julho?".
 *
 * O QUE NUNCA ENTRA AQUI (CLAUDE.md §sensíveis):
 *   - nome de parte, CPF/CNPJ, e-mail, telefone, endereço
 *   - placa, apólice, número ou motivo de sinistro
 *   - valor de acordo, condenação ou provisionamento por processo
 *
 * O que entra: a ação, o alvo em forma de identificador, e contagens
 * agregadas. "Importou 836 processos" é auditoria; "importou o processo do
 * Fulano no valor de X" é vazamento com carimbo de data.
 *
 * FALHA SILENCIOSA, de propósito: se o log não puder ser gravado, a operação
 * principal continua. Um problema no banco de auditoria não deve impedir o
 * Jurídico de importar a planilha do mês. O erro vai para o console do
 * servidor, onde é visível para quem opera.
 */

export interface EventoAuditoria {
  usuarioId?: string
  /** Verbo em caixa alta: LOGIN, IMPORTACAO_CONFIRMADA, USUARIO_CONVIDADO. */
  acao: string
  /** Identificador do objeto afetado — id de importação, e-mail nunca. */
  alvo?: string
  /** Contexto agregado. Passa pelo filtro abaixo antes de ser gravado. */
  detalhe?: Record<string, unknown>
}

/**
 * Chaves proibidas no `detalhe`.
 *
 * Segunda linha de defesa: a primeira é quem chama não passar dado sensível.
 * Esta existe porque um `detalhe` montado com spread de um objeto maior pode
 * carregar campos que ninguém pretendia registrar.
 */
const PROIBIDAS = [
  'cpf', 'cnpj', 'email', 'telefone', 'endereco', 'placa',
  'apolice', 'sinistro', 'nome', 'autor', 'reu', 'parte',
  'valoracordo', 'valorcondenacao', 'valorprovisionado', 'senha', 'password',
  'token', 'secret', 'key',
]

/** Só primitivos — o que sobra depois do filtro, e o que o Prisma aceita. */
type ValorSeguro = string | number | boolean | null

function limpar(detalhe: Record<string, unknown>): Record<string, ValorSeguro> {
  const limpo: Record<string, ValorSeguro> = {}
  for (const [chave, valor] of Object.entries(detalhe)) {
    const k = chave
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[_-]/g, '')

    if (PROIBIDAS.some(p => k.includes(p))) {
      limpo[chave] = '[removido]'
      continue
    }
    // Só primitivos. Objeto aninhado esconderia campo sensível do filtro,
    // que só inspeciona as chaves do primeiro nível.
    if (
      valor === null ||
      typeof valor === 'string' ||
      typeof valor === 'number' ||
      typeof valor === 'boolean'
    ) {
      limpo[chave] = valor
    } else {
      limpo[chave] = '[objeto omitido]'
    }
  }
  return limpo
}

export async function registrar(evento: EventoAuditoria): Promise<void> {
  if (!config.AUDIT_LOG_HABILITADO) return

  try {
    await prisma.logAuditoria.create({
      data: {
        usuarioId: evento.usuarioId ?? null,
        acao: evento.acao,
        alvo: evento.alvo ?? null,
        detalhe: evento.detalhe ? limpar(evento.detalhe) : undefined,
      },
    })
  } catch (e) {
    // Não relança: auditoria indisponível não bloqueia o trabalho.
    console.error('[auditoria] falha ao registrar', evento.acao, e)
  }
}

/** Exportado só para teste — o filtro precisa ser verificável isoladamente. */
export const _limparParaTeste = limpar
