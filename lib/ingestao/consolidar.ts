/**
 * Consolidação: transforma as linhas lidas em registros prontos para gravar.
 *
 * Este módulo resolve as três perguntas que decidem se o reenvio mensal
 * funciona ou corrompe o histórico:
 *
 *   1. Este processo já existe de meses anteriores, ou é novo? (identidade)
 *   2. O mesmo processo apareceu duas vezes NESTE upload? (precedência)
 *   3. Esta parcela já foi recebida antes? (chave composta)
 *
 * É lógica pura — não toca no banco — para poder ser testada exaustivamente.
 */

import type { LinhaLida, ParcelaLida, Pendencia } from './ler-planilha.ts'
import { chaveComparacao } from './normalizar.ts'

/** Valor genérico que o escritório usa para processo ainda sem número. */
const SEM_NUMERO = 'a distribuir'

export interface RegistroConsolidado {
  /**
   * Chave de IDENTIDADE entre importações. Não é a chave técnica do banco —
   * é o que permite reencontrar, no mês seguinte, o mesmo processo.
   */
  chaveIdentidade: string
  numeroProcesso: string | null
  ficha: string | null
  carteira: string | null
  encerrado: boolean
  campos: LinhaLida['campos']
  parcelas: ParcelaLida[]
  /** Origem, para auditoria e para a tela de validação. */
  origem: { aba: string; linha: number }
  pendencias: Pendencia[]
}

export interface ResultadoConsolidacao {
  registros: RegistroConsolidado[]
  pendencias: Pendencia[]
  /** numero_processo repetido no mesmo upload, para revisão humana. */
  reconciliacao: ItemReconciliacao[]
}

export interface ItemReconciliacao {
  numeroProcesso: string
  ocorrencias: { aba: string; linha: number; ficha: string | null; tipoAcao: string | null }[]
  /** true quando o padrão é o IDPJ legítimo e NÃO precisa de revisão. */
  explicadoPorIdpj: boolean
}

/**
 * REGRA 5 — chave de identidade do processo entre importações.
 *
 * A cascata importa:
 *
 * 1. `ficha` primeiro. É o identificador que o escritório mantém estável mês a
 *    mês, e é o único que distingue um IDPJ do processo principal — os dois
 *    tramitam nos MESMOS autos e compartilham `numero_processo`.
 * 2. `numero_processo` como alternativa, quando não há ficha.
 *
 * `"A DISTRIBUIR"` nunca entra na chave: é valor genérico compartilhado por
 * vários processos. Usá-lo fundiria processos distintos num só.
 *
 * A ficha ser usada para CASAR não contradiz a decisão de não usá-la como
 * chave técnica: a chave do banco continua sendo um id interno. Numa eventual
 * troca de escritório, o vínculo histórico já gravado permanece.
 */
export function chaveIdentidade(
  numeroProcesso: string | null,
  ficha: string | null
): string | null {
  const f = ficha?.trim()
  if (f) return `ficha:${chaveComparacao(f)}`

  const n = numeroProcesso?.trim()
  if (n && chaveComparacao(n) !== SEM_NUMERO) return `processo:${chaveComparacao(n)}`

  return null
}

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function ehIdpj(tipoAcao: string | null): boolean {
  if (!tipoAcao) return false
  const k = chaveComparacao(tipoAcao)
  return k.includes('desconsideracao da personalidade juridica') || k.includes('idpj')
}

export function consolidar(linhas: LinhaLida[]): ResultadoConsolidacao {
  const pendencias: Pendencia[] = []
  const porChave = new Map<string, RegistroConsolidado>()
  /** numero_processo -> ocorrências, para o relatório de reconciliação. */
  const porNumero = new Map<string, ItemReconciliacao['ocorrencias']>()

  for (const l of linhas) {
    const numeroProcesso = texto(l.campos.numero_processo)
    const ficha = texto(l.campos.ficha)
    const tipoAcao = texto(l.campos.tipo_acao)

    const chave = chaveIdentidade(numeroProcesso, ficha)
    if (!chave) {
      pendencias.push({
        tipo: 'LINHA_SEM_IDENTIFICADOR',
        aba: l.aba,
        linha: l.linha,
        detalhe:
          'Linha sem ficha e sem número de processo utilizável ' +
          `(${JSON.stringify(numeroProcesso ?? '')}). Não é possível identificá-la ` +
          'entre importações; ficou pendente.',
      })
      continue
    }

    if (numeroProcesso && chaveComparacao(numeroProcesso) !== SEM_NUMERO) {
      const k = chaveComparacao(numeroProcesso)
      const lista = porNumero.get(k) ?? []
      lista.push({ aba: l.aba, linha: l.linha, ficha, tipoAcao })
      porNumero.set(k, lista)
    }

    const novo: RegistroConsolidado = {
      chaveIdentidade: chave,
      numeroProcesso,
      ficha,
      carteira: l.carteira ?? texto(l.campos.cliente),
      encerrado: l.encerrado,
      campos: l.campos,
      parcelas: l.parcelas,
      origem: { aba: l.aba, linha: l.linha },
      pendencias: l.pendencias,
    }

    const existente = porChave.get(chave)
    if (!existente) {
      porChave.set(chave, novo)
      continue
    }

    porChave.set(chave, resolverConflito(existente, novo, pendencias))
  }

  const reconciliacao: ItemReconciliacao[] = []
  for (const [numero, ocorrencias] of porNumero) {
    if (ocorrencias.length < 2) continue
    reconciliacao.push({
      numeroProcesso: numero,
      ocorrencias,
      // Caso legítimo confirmado com o Jurídico: o IDPJ tramita nos mesmos
      // autos do principal e tem ficha própria. Não é erro de cadastro.
      explicadoPorIdpj: ocorrencias.some(o => ehIdpj(o.tipoAcao)),
    })
  }

  return { registros: [...porChave.values()], pendencias, reconciliacao }
}

/**
 * REGRA 8 — mesmo processo em duas abas no MESMO upload: BAIXADOS vence.
 *
 * A precedência é por CONTEÚDO, não por ordem de leitura: se dependesse da
 * ordem das abas no arquivo, o escritório reordenar as abas mudaria o
 * resultado do provisionamento.
 */
function resolverConflito(
  a: RegistroConsolidado,
  b: RegistroConsolidado,
  pendencias: Pendencia[]
): RegistroConsolidado {
  if (a.encerrado !== b.encerrado) {
    const vencedor = a.encerrado ? a : b
    const perdedor = a.encerrado ? b : a

    pendencias.push({
      tipo: 'CONFLITO_BAIXADOS_ATIVA',
      aba: perdedor.origem.aba,
      linha: perdedor.origem.linha,
      detalhe:
        `Processo aparece em ${perdedor.origem.aba} (linha ${perdedor.origem.linha}) ` +
        `e em ${vencedor.origem.aba} (linha ${vencedor.origem.linha}). ` +
        'BAIXADOS venceu: o processo está encerrado.',
    })

    // A linha ativa costuma ter mais campos (BAIXADOS tem schema reduzido).
    // Preserva os campos da ativa, mas mantém o estado de encerrado.
    return {
      ...vencedor,
      campos: { ...perdedor.campos, ...limparVazios(vencedor.campos) },
      parcelas: vencedor.parcelas.length ? vencedor.parcelas : perdedor.parcelas,
      pendencias: [...a.pendencias, ...b.pendencias],
    }
  }

  // Mesma natureza nas duas: duplicata dentro do mesmo grupo de abas.
  pendencias.push({
    tipo: 'NUMERO_PROCESSO_REPETIDO',
    aba: b.origem.aba,
    linha: b.origem.linha,
    detalhe:
      `Mesma identidade em ${a.origem.aba} (linha ${a.origem.linha}) e ` +
      `${b.origem.aba} (linha ${b.origem.linha}). A primeira ocorrência foi mantida.`,
  })
  return {
    ...a,
    campos: { ...b.campos, ...limparVazios(a.campos) },
    pendencias: [...a.pendencias, ...b.pendencias],
  }
}

/** Remove chaves nulas para que o spread não apague valor bom com null. */
function limparVazios(
  campos: LinhaLida['campos']
): LinhaLida['campos'] {
  const out: LinhaLida['campos'] = {}
  for (const [k, v] of Object.entries(campos)) {
    if (v !== null && v !== undefined) {
      out[k as keyof LinhaLida['campos']] = v as never
    }
  }
  return out
}

/**
 * Junta os registros da planilha de Acordos aos do Relatório Geral.
 *
 * A planilha de Acordos duplica vários campos que já vêm do Geral (Cliente,
 * Risco, Fase, Valor Provisionado, Resultado). Só o que é EXCLUSIVO dela é
 * aproveitado — o resto não pode sobrescrever o que veio do Geral, que é a
 * fonte mais completa.
 */
const CAMPOS_EXCLUSIVOS_ACORDO = [
  'termos_acordo',
  'valor_acordo',
] as const

export interface ResultadoMesclagem {
  registros: RegistroConsolidado[]
  /** Acordos cujo processo não existe no Relatório Geral do mesmo mês. */
  orfaos: RegistroConsolidado[]
}

export function mesclarAcordos(
  doGeral: RegistroConsolidado[],
  dosAcordos: RegistroConsolidado[]
): ResultadoMesclagem {
  const porChave = new Map(doGeral.map(r => [r.chaveIdentidade, r]))
  const orfaos: RegistroConsolidado[] = []

  for (const acordo of dosAcordos) {
    const alvo = porChave.get(acordo.chaveIdentidade)

    if (!alvo) {
      // Confirmado na carga real: 5 fichas com parcela ativa que não constam
      // no Relatório Geral do mesmo mês. Não bloqueia a importação — é
      // registrado para cobrança junto ao escritório.
      orfaos.push(acordo)
      continue
    }

    for (const campo of CAMPOS_EXCLUSIVOS_ACORDO) {
      const v = acordo.campos[campo]
      if (v !== null && v !== undefined) alvo.campos[campo] = v
    }
    // As parcelas só existem na planilha de Acordos.
    alvo.parcelas = acordo.parcelas
    alvo.pendencias = [...alvo.pendencias, ...acordo.pendencias]
  }

  return { registros: [...porChave.values()], orfaos }
}
