/**
 * Normalizadores de célula.
 *
 * Todos os formatos tratados aqui foram observados nas planilhas REAIS de
 * junho e julho/2026 (ver scripts/perfilar-valores.ts). Nada é especulação.
 *
 * Princípio geral (REGRA 10): valor que não dá para interpretar com segurança
 * NUNCA é adivinhado. Retorna null com um motivo, e o motivo vira pendência
 * na tela de validação. Uma linha problemática não trava o lote.
 */

export interface Resultado<T> {
  valor: T | null
  /** Preenchido quando o valor não pôde ser interpretado. Vira pendência. */
  motivo?: string
}

const ok = <T>(valor: T): Resultado<T> => ({ valor })
/** Ausência sem pendência. Helper próprio para o tipo não inferir `null`. */
const vazio = <T>(): Resultado<T> => ({ valor: null })
const falha = <T>(motivo: string): Resultado<T> => ({ valor: null, motivo })

/** Ausência declarada. Nas planilhas, vazio é a string "N/A", não célula vazia. */
function ausente(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') {
    const s = v.trim()
    return s === '' || /^n\/?a$/i.test(s) || /^-+$/.test(s)
  }
  return false
}

// ---------------------------------------------------------------------------
// TEXTO
// ---------------------------------------------------------------------------

/**
 * Texto limpo, ou null se ausente.
 *
 * O trim resolve o `Status` da planilha real: "ATIVO " (742x, com espaço à
 * direita) e "ATIVO" (11x) são o mesmo valor. Sem isto, um filtro por status
 * perderia 11 processos — ou 742, dependendo de qual grafia for usada.
 */
export function parseTexto(v: unknown): Resultado<string> {
  if (ausente(v)) return vazio()
  const s = String(v).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim()
  return s === '' ? vazio<string>() : ok(s)
}

/** Compara ignorando caixa, acento e espaço. Para vocabulário controlado. */
export function chaveComparacao(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// ---------------------------------------------------------------------------
// DATA
// ---------------------------------------------------------------------------

/**
 * Textos que declaram ausência de data, em vez de erro.
 *
 * Lista curta e explícita de propósito: qualquer outro texto continua virando
 * pendência. Ampliar esta lista é decisão de negócio, não de implementação.
 */
const SEM_DATA: RegExp[] = [
  /^ainda\s+n[ãa]o\s+fomos\s+citados?/i,
  /^n[ãa]o\s+(fomos\s+)?citados?$/i,
  /^sem\s+cita[çc][ãa]o$/i,
  /^aguardando\s+cita[çc][ãa]o$/i,
  /^a\s+distribuir$/i,
]

/**
 * Data a partir de célula que pode vir como Date do Excel OU texto.
 *
 * Os dois formatos convivem NA MESMA COLUNA nas planilhas reais:
 *   data_ajuizamento  -> 798x Date do Excel + 1x texto DD/MM/AAAA
 *   data_encerramento ->  36x texto DD/MM/AAAA + 1x Date do Excel
 * Por isso o tipo é checado célula a célula, nunca assumido por coluna.
 *
 * O retorno é sempre meia-noite UTC: estes campos são datas de calendário, e
 * manter a hora local faria a data "andar" um dia ao serializar em fuso
 * negativo como o do Brasil.
 */
export function parseData(v: unknown): Resultado<Date> {
  if (ausente(v)) return vazio()

  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return falha('data inválida')
    // SheetJS devolve a data no fuso local; recompõe em UTC para não deslocar.
    return ok(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())))
  }

  if (typeof v === 'number') {
    // Serial do Excel (epoch 1899-12-30). Só aceita faixa plausível.
    if (v < 1 || v > 80000) return falha(`serial de data fora da faixa: ${v}`)
    const ms = Math.round((v - 25569) * 86400 * 1000)
    const d = new Date(ms)
    return ok(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())))
  }

  const s = String(v).trim()

  // Textos que significam "não há data", e não erro de preenchimento.
  // "Ainda não fomos citados" aparece 240x na coluna Citação real: o processo
  // existe, a citação não ocorreu. Virar pendência seria ruído, não sinal.
  if (SEM_DATA.some(re => re.test(s))) return vazio()

  // A coluna Citação real tem espaço injetado DENTRO do número em 1100+ linhas
  // ("27/07/20 17", "2020-10- 15", "27.07.20 17"). Remover todo espaço antes de
  // casar o padrão é seguro: se o resultado não formar uma data válida, ainda
  // assim vira pendência. O que não é seguro é adivinhar dígitos faltantes.
  const limpo = s
    .replace(/[\s   .]+/g, m => (m.includes('.') ? '.' : ''))
    .replace(/[.\-/]+$/, '') // separador sobrando no fim ("27/07/2017.")

  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(limpo)
  if (br) return montarData(+br[3], +br[2], +br[1], s)

  const isoRe = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(limpo)
  if (isoRe) return montarData(+isoRe[1], +isoRe[2], +isoRe[3], s)

  return falha(`formato de data não reconhecido: ${JSON.stringify(s.slice(0, 40))}`)
}

function montarData(ano: number, mes: number, dia: number, orig: string): Resultado<Date> {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return falha(`data impossível: ${JSON.stringify(orig)}`)
  }
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  // Rejeita rolagem silenciosa: 31/02 vira 03/03 se não for checado.
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return falha(`data inexistente no calendário: ${JSON.stringify(orig)}`)
  }
  return ok(d)
}

// ---------------------------------------------------------------------------
// NÚMERO
// ---------------------------------------------------------------------------

/**
 * Valor monetário. Nas planilhas reais os campos de valor vêm como número,
 * mas texto aparece em `Êxito do processo` — por isso o texto é suportado.
 *
 * Trata a notação pt-BR ("1.234,56") e a en-US ("1,234.56"). Quando as duas
 * leituras são possíveis e divergem, RECUSA em vez de escolher: interpretar
 * "1.234" como 1234 ou 1,234 muda o passivo por um fator de mil.
 */
export function parseNumero(v: unknown): Resultado<number> {
  if (ausente(v)) return vazio()

  if (typeof v === 'number') {
    return Number.isFinite(v) ? ok(v) : falha('número não finito')
  }

  let s = String(v).trim().replace(/^R\$\s*/i, '').replace(/\s/g, '')
  if (s === '') return vazio()

  const negativo = /^\(.*\)$/.test(s)
  if (negativo) s = s.slice(1, -1)

  if (!/^[-+]?[\d.,]+$/.test(s)) {
    return falha(`não é um número: ${JSON.stringify(String(v).trim().slice(0, 40))}`)
  }

  const temPonto = s.includes('.')
  const temVirgula = s.includes(',')
  let normal: string

  if (temPonto && temVirgula) {
    // O separador decimal é o que aparece por último.
    normal =
      s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '')
  } else if (temVirgula) {
    normal = s.replace(',', '.')
  } else if (temPonto) {
    const partes = s.split('.')
    const ultima = partes[partes.length - 1]
    if (partes.length > 2 && ultima.length === 2) {
      // "12.345.67" — milhar com ponto E decimal com ponto. Ambíguo de verdade:
      // pode ser 12345.67 ou 1234567. Observado no Êxito do processo real.
      return falha(
        `separador decimal ambíguo: ${JSON.stringify(String(v).trim().slice(0, 40))}`
      )
    }
    normal = partes.length > 2 ? s.replace(/\./g, '') : s
  } else {
    normal = s
  }

  const n = Number(normal)
  if (!Number.isFinite(n)) {
    return falha(`não é um número: ${JSON.stringify(String(v).trim().slice(0, 40))}`)
  }
  return ok(negativo ? -n : n)
}

// ---------------------------------------------------------------------------
// SIM / NÃO
// ---------------------------------------------------------------------------

/**
 * Tri-estado, não booleano.
 *
 * `M.G.A está no polo passivo` tem "SIM" (19x), "NÃO" (10x) e "N/A" (770x) na
 * planilha real. "N/A" é ausência legítima — significa que não há representante
 * de seguros envolvido — e NÃO deve virar `false`.
 */
export function parseSimNao(v: unknown): Resultado<boolean> {
  if (ausente(v)) return vazio()
  const k = chaveComparacao(String(v))
  if (['sim', 's', 'true', '1'].includes(k)) return ok(true)
  if (['nao', 'n', 'false', '0'].includes(k)) return ok(false)
  return falha(`valor sim/não não reconhecido: ${JSON.stringify(String(v).slice(0, 30))}`)
}

// ---------------------------------------------------------------------------
// RISCO
// ---------------------------------------------------------------------------

export type RiscoNormalizado = 'PROVAVEL' | 'POSSIVEL' | 'REMOTO'

const RISCOS: Record<string, RiscoNormalizado> = {
  provavel: 'PROVAVEL',
  possivel: 'POSSIVEL',
  remoto: 'REMOTO',
}

/**
 * O risco governa o cálculo de provisionamento em todos os cenários. Valor
 * desconhecido NUNCA vira um padrão — se virasse "REMOTO", o passivo apareceria
 * menor do que é.
 */
export function parseRisco(v: unknown): Resultado<RiscoNormalizado> {
  if (ausente(v)) return vazio()
  const r = RISCOS[chaveComparacao(String(v))]
  return r ? ok(r) : falha(`risco não reconhecido: ${JSON.stringify(String(v).slice(0, 30))}`)
}

// ---------------------------------------------------------------------------
// ÊXITO DO PROCESSO — REGRA 2
// ---------------------------------------------------------------------------

export interface Exito {
  /** O texto original, SEMPRE preservado. É o valor curado pelo escritório. */
  bruto: string
  /** Número extraído, quando isso é seguro. null quando não é. */
  numerico: number | null
  motivo?: string
}

/** Um valor monetário dentro de texto livre. */
const RE_MOEDA = /R\$\s*([\d.,]+)/gi

/**
 * REGRA 2 — `Êxito do processo` é curado manualmente. NUNCA recalcular.
 *
 * Formatos reais em julho/2026: 764x número puro, 33x texto com R$, 2x texto
 * livre. Entre os textos aparecem casos que não podem ser adivinhados:
 *
 *   "R$ 12.345,67 - Dano moral não concedido"      -> um valor + explicação
 *   "R$ 12.345,67 (Danos moral) + R$ 890,12 (...)" -> DOIS valores
 *   "R$"                                            -> sem número
 *   "R$ 12.345.67"                                  -> decimal ambíguo
 *
 * O caso de dois valores é o perigoso: extrair só o primeiro subestimaria o
 * êxito em silêncio. Aqui ele vira pendência para revisão humana.
 */
export function parseExito(v: unknown): Resultado<Exito> {
  if (ausente(v)) return vazio()

  if (typeof v === 'number') {
    return Number.isFinite(v)
      ? ok({ bruto: String(v), numerico: v })
      : falha('êxito numérico não finito')
  }

  const bruto = String(v).replace(/\s+/g, ' ').trim()
  if (bruto === '') return vazio()

  const achados = [...bruto.matchAll(RE_MOEDA)]

  if (achados.length === 0) {
    // Pode ser um número sem "R$", ou texto puro como "0 (zerado)".
    const n = parseNumero(bruto)
    if (n.valor !== null) return ok({ bruto, numerico: n.valor })
    return ok({
      bruto,
      numerico: null,
      motivo: `Êxito sem valor numérico identificável: ${JSON.stringify(bruto.slice(0, 60))}`,
    })
  }

  if (achados.length > 1) {
    // Ex.: "R$ X (danos morais) + R$ Y (coparticipação)".
    // Somar seria inventar; pegar o primeiro seria subestimar. Recusa e reporta.
    return ok({
      bruto,
      numerico: null,
      motivo:
        `Êxito com ${achados.length} valores monetários no mesmo campo — ` +
        `requer revisão humana: ${JSON.stringify(bruto.slice(0, 60))}`,
    })
  }

  const n = parseNumero(achados[0][1])
  if (n.valor === null) {
    return ok({ bruto, numerico: null, motivo: n.motivo })
  }
  return ok({ bruto, numerico: n.valor })
}
