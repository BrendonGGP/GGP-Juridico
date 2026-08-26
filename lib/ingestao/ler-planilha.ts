/**
 * Leitor de planilha: transforma um arquivo .xlsx em registros normalizados.
 *
 * Combina a resolução de colunas (REGRA 3) com os normalizadores de célula, e
 * aplica as regras estruturais: aba GERAL não importada (REGRA 9), precedência
 * de BAIXADOS (REGRA 8), lista de permissão de abas, e — acima de tudo — uma
 * linha com problema vira pendência e NÃO trava o lote (REGRA 10).
 *
 * Este módulo NÃO grava nada. Ele lê e reporta. A gravação transacional é
 * responsabilidade do motor de ingestão, que consome este resultado.
 */

import * as XLSX from 'xlsx'
import {
  resolverCabecalho,
  type CampoLogico,
} from './mapeamento-colunas.ts'
import {
  parseData,
  parseNumero,
  parseTexto,
  parseRisco,
  parseSimNao,
  parseExito,
  type Exito,
  type RiscoNormalizado,
} from './normalizar.ts'
import { classificarAba, carteiraDaAba, type TipoAba } from './abas.ts'

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

export type TipoPendencia =
  | 'COLUNA_NAO_RECONHECIDA'
  | 'COLUNA_DUPLICADA'
  | 'ABA_NAO_RECONHECIDA'
  | 'ABA_SEM_CABECALHO'
  | 'VALOR_NAO_PARSEAVEL'
  | 'LINHA_SEM_IDENTIFICADOR'
  | 'GERAL_DIVERGENTE'
  /** Mesmo processo em BAIXADOS e numa aba ativa. REGRA 8. */
  | 'CONFLITO_BAIXADOS_ATIVA'
  /** Mesma identidade duas vezes no mesmo upload. */
  | 'NUMERO_PROCESSO_REPETIDO'
  /** Acordo cujo processo não existe no Relatório Geral do mesmo mês. */
  | 'ACORDO_ORFAO'

export interface Pendencia {
  tipo: TipoPendencia
  aba: string
  /** Linha na planilha, 1-based, como o usuário vê no Excel. */
  linha?: number
  campo?: string
  detalhe: string
}

/** Valor de um campo já normalizado. */
export type ValorCampo = string | number | boolean | Date | Exito | RiscoNormalizado | null

/** Uma parcela de acordo, extraída de um par de colunas de mês. */
export interface ParcelaLida {
  /** "2026-07" — o mês a que a parcela se refere, NÃO o mês da importação. */
  mesReferencia: string
  dataPagamento: Date | null
  valor: number
}

export interface LinhaLida {
  aba: string
  /** 1-based, para casar com o que o usuário vê no Excel. */
  linha: number
  /** Carteira da aba; null quando a aba mistura clientes (usar campo cliente). */
  carteira: string | null
  /** REGRA 8: veio da aba BAIXADOS, portanto encerrado. */
  encerrado: boolean
  campos: Partial<Record<CampoLogico, ValorCampo>>
  /** Parcelas de acordo desta linha (só na planilha de Acordos). */
  parcelas: ParcelaLida[]
  /** Pendências desta linha. A linha é aproveitada mesmo assim. */
  pendencias: Pendencia[]
}

export interface ResultadoLeitura {
  linhas: LinhaLida[]
  /** Pendências de nível de aba ou arquivo (não ligadas a uma linha). */
  pendencias: Pendencia[]
  abasLidas: { nome: string; tipo: TipoAba; linhas: number }[]
  /** Pares DATA DE PAGAMENTO / VALOR DA PARCELA detectados (planilha Acordos). */
  mesesDetectados: string[]
}

// ---------------------------------------------------------------------------
// PARSERS POR CAMPO
// ---------------------------------------------------------------------------

type Parser = (v: unknown) => { valor: ValorCampo; motivo?: string }

const CAMPOS_DATA: CampoLogico[] = [
  'data_cadastro',
  'data_ajuizamento',
  'data_citacao',
  'data_encerramento',
  'data_condenacao',
  'data_atualizacao_condenacao',
  'data_sinistro',
  'data_valor_estimado',
]

const CAMPOS_NUMERO: CampoLogico[] = [
  'valor_causa',
  'valor_acordo',
  'valor_condenacao',
  'valor_provisionado',
]

function parserDe(campo: CampoLogico): Parser {
  if (CAMPOS_DATA.includes(campo)) return parseData
  if (CAMPOS_NUMERO.includes(campo)) return parseNumero
  if (campo === 'risco') return parseRisco
  if (campo === 'mga_polo_passivo') return parseSimNao
  if (campo === 'exito_processo') return parseExito
  return parseTexto
}

// ---------------------------------------------------------------------------
// CABEÇALHO
// ---------------------------------------------------------------------------

/** Pares dinâmicos da planilha de Acordos: um por mês, crescendo a cada envio. */
const RE_COLUNA_MES =
  /^\s*(DATA DE PAGAMENTO|VALOR DA PARCELA)\s*\(?\s*([A-Za-zÀ-ÿ]+)\s*\/\s*(\d{4})/i

export interface ColunaMes {
  indice: number
  tipo: 'data' | 'valor'
  /** "2026-07" */
  mesReferencia: string
}

const MESES: Record<string, string> = {
  janeiro: '01', fevereiro: '02', marco: '03', abril: '04',
  maio: '05', junho: '06', julho: '07', agosto: '08',
  setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
}

function interpretarColunaMes(nome: string, indice: number): ColunaMes | null {
  const m = RE_COLUNA_MES.exec(nome)
  if (!m) return null
  const mes = MESES[m[2].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()]
  if (!mes) return null
  return {
    indice,
    tipo: /DATA/i.test(m[1]) ? 'data' : 'valor',
    mesReferencia: `${m[3]}-${mes}`,
  }
}

/**
 * Descobre em qual linha está o cabeçalho.
 *
 * As planilhas reais abrem com uma faixa de título mesclada, então a linha 1
 * não é o cabeçalho — algo que a especificação não registra. Procurar em vez
 * de fixar "linha 2" resiste a o escritório inserir outra linha de topo.
 */
function detectarCabecalho(ws: XLSX.WorkSheet, range: XLSX.Range, maxLinhas = 10) {
  let melhor = { linha: range.s.r, pontos: -1, nomes: [] as string[] }
  const limite = Math.min(range.s.r + maxLinhas, range.e.r)

  for (let r = range.s.r; r <= limite; r++) {
    const nomes: string[] = []
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cel = ws[XLSX.utils.encode_cell({ r, c })]
      nomes.push(cel ? String(cel.v ?? '').trim() : '')
    }
    const preenchidos = nomes.filter(n => n !== '')
    if (!preenchidos.length) continue
    const pontos = resolverCabecalho(preenchidos).mapeadas.size
    if (pontos > melhor.pontos) melhor = { linha: r, pontos, nomes }
  }

  return melhor
}

// ---------------------------------------------------------------------------
// LEITURA
// ---------------------------------------------------------------------------

export function lerPlanilha(buffer: Buffer): ResultadoLeitura {
  const wb = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    // Não avaliar fórmulas: o arquivo vem de terceiro e é dado não confiável.
    cellFormula: false,
    cellHTML: false,
  })

  const linhas: LinhaLida[] = []
  const pendencias: Pendencia[] = []
  const abasLidas: ResultadoLeitura['abasLidas'] = []
  const mesesDetectados = new Set<string>()

  /** numero_processo visto em aba ativa, para a checagem de GERAL. */
  const idsPorAba = new Map<string, string[]>()

  for (const nomeAba of wb.SheetNames) {
    const tipo = classificarAba(nomeAba)

    if (tipo === 'DESCONHECIDA') {
      pendencias.push({
        tipo: 'ABA_NAO_RECONHECIDA',
        aba: nomeAba,
        detalhe:
          `Aba não reconhecida: ${JSON.stringify(nomeAba)}. ` +
          'Não foi importada. Cadastre-a como carteira conhecida se for legítima.',
      })
      continue
    }

    const ws = wb.Sheets[nomeAba]
    if (!ws['!ref']) {
      pendencias.push({
        tipo: 'ABA_SEM_CABECALHO',
        aba: nomeAba,
        detalhe: 'Aba vazia.',
      })
      continue
    }

    const range = XLSX.utils.decode_range(ws['!ref'])
    const cab = detectarCabecalho(ws, range)

    if (cab.pontos <= 0) {
      pendencias.push({
        tipo: 'ABA_SEM_CABECALHO',
        aba: nomeAba,
        detalhe: 'Nenhuma linha das 10 primeiras parece um cabeçalho reconhecível.',
      })
      continue
    }

    // Separa as colunas de mês (Acordos) das colunas normais.
    const colunasMes: ColunaMes[] = []
    const nomesNormais: string[] = []
    const indicesNormais: number[] = []

    cab.nomes.forEach((nome, i) => {
      if (nome === '') return
      const cm = interpretarColunaMes(nome, i)
      if (cm) {
        colunasMes.push(cm)
        mesesDetectados.add(cm.mesReferencia)
      } else {
        nomesNormais.push(nome)
        indicesNormais.push(i)
      }
    })

    const resolucao = resolverCabecalho(nomesNormais)

    for (const nr of resolucao.naoReconhecidas) {
      pendencias.push({
        tipo: 'COLUNA_NAO_RECONHECIDA',
        aba: nomeAba,
        linha: cab.linha + 1,
        campo: nr.nome,
        detalhe:
          `Coluna sem mapeamento: ${JSON.stringify(nr.nome)}. ` +
          'Cadastre um apelido ou confirme que pode ser ignorada.',
      })
    }
    for (const d of resolucao.duplicadas) {
      pendencias.push({
        tipo: 'COLUNA_DUPLICADA',
        aba: nomeAba,
        linha: cab.linha + 1,
        campo: d.campo,
        detalhe:
          `Mais de uma coluna resolve para "${d.campo}": ${d.nomes.join(' / ')}. ` +
          'A primeira foi usada.',
      })
    }

    // Índice na planilha = posição dentro de nomesNormais mapeada de volta.
    const colunaDe = new Map<CampoLogico, number>()
    for (const [campo, posNormal] of resolucao.mapeadas) {
      colunaDe.set(campo, range.s.c + indicesNormais[posNormal])
    }

    const encerrado = tipo === 'BAIXADOS'
    const carteira = tipo === 'ACORDOS' ? null : carteiraDaAba(nomeAba)
    const ehGeral = tipo === 'GERAL'
    const idsDaAba: string[] = []
    let lidas = 0

    for (let r = cab.linha + 1; r <= range.e.r; r++) {
      const resultado = lerLinha(ws, r, colunaDe, nomeAba)
      if (!resultado) continue // linha totalmente vazia

      const { campos, pendenciasLinha } = resultado
      const parcelas = lerParcelas(ws, r, range, colunasMes, nomeAba, pendenciasLinha)

      // A última linha da planilha de Acordos é um TOTAL: processo e ficha
      // vazios. Somá-la duplicaria o valor de todos os acordos.
      const semIdentificador =
        !campos.numero_processo && !campos.ficha && !campos.numero_ordem
      if (semIdentificador) {
        const temValor = Object.values(campos).some(v => v !== null && v !== undefined)
        if (temValor && !ehGeral) {
          pendencias.push({
            tipo: 'LINHA_SEM_IDENTIFICADOR',
            aba: nomeAba,
            linha: r + 1,
            detalhe:
              'Linha com valores mas sem processo/ficha — tratada como linha de ' +
              'total e descartada.',
          })
        }
        continue
      }

      lidas++
      const id = String(campos.numero_processo ?? campos.ficha ?? '')
      if (id) idsDaAba.push(id)

      // REGRA 9: GERAL é lida para conferência, mas não vira registro.
      if (ehGeral) continue

      linhas.push({
        aba: nomeAba,
        linha: r + 1,
        carteira,
        encerrado,
        campos,
        parcelas,
        pendencias: pendenciasLinha,
      })
    }

    idsPorAba.set(nomeAba, idsDaAba)
    abasLidas.push({ nome: nomeAba, tipo, linhas: lidas })
  }

  verificarGeral(idsPorAba, pendencias)

  return {
    linhas,
    pendencias,
    abasLidas,
    mesesDetectados: [...mesesDetectados].sort(),
  }
}

/**
 * Extrai as parcelas de acordo de uma linha, a partir dos pares de mês.
 *
 * Cada mês vira uma parcela própria, identificada pelo MÊS DE REFERÊNCIA e não
 * pela ordem da coluna. Isso é o que torna o reenvio mensal seguro: quando a
 * planilha de agosto reenviar as colunas de maio a dezembro, cada parcela é
 * reconhecida pelo mesmo mês de referência e ATUALIZA a existente em vez de
 * criar outra (REGRA 4).
 *
 * Parcela sem valor é ignorada: mês futuro ainda não preenchido é o caso
 * normal, não uma falha.
 */
function lerParcelas(
  ws: XLSX.WorkSheet,
  r: number,
  range: XLSX.Range,
  colunasMes: ColunaMes[],
  nomeAba: string,
  pendenciasLinha: Pendencia[]
): ParcelaLida[] {
  if (!colunasMes.length) return []

  const porMes = new Map<string, { data?: unknown; valor?: unknown }>()
  for (const cm of colunasMes) {
    const cel = ws[XLSX.utils.encode_cell({ r, c: range.s.c + cm.indice })]
    const atual = porMes.get(cm.mesReferencia) ?? {}
    atual[cm.tipo === 'data' ? 'data' : 'valor'] = cel ? cel.v : undefined
    porMes.set(cm.mesReferencia, atual)
  }

  const parcelas: ParcelaLida[] = []
  for (const [mesReferencia, par] of porMes) {
    const v = parseNumero(par.valor)
    if (v.motivo) {
      pendenciasLinha.push({
        tipo: 'VALOR_NAO_PARSEAVEL',
        aba: nomeAba,
        linha: r + 1,
        campo: `parcela ${mesReferencia}`,
        detalhe: v.motivo,
      })
      continue
    }
    // Mês sem valor é mês ainda não pago/previsto — não é parcela.
    if (v.valor === null || v.valor === 0) continue

    const d = parseData(par.data)
    if (d.motivo) {
      pendenciasLinha.push({
        tipo: 'VALOR_NAO_PARSEAVEL',
        aba: nomeAba,
        linha: r + 1,
        campo: `data da parcela ${mesReferencia}`,
        detalhe: d.motivo,
      })
    }

    parcelas.push({ mesReferencia, dataPagamento: d.valor, valor: v.valor })
  }

  return parcelas.sort((a, b) => a.mesReferencia.localeCompare(b.mesReferencia))
}

function lerLinha(
  ws: XLSX.WorkSheet,
  r: number,
  colunaDe: Map<CampoLogico, number>,
  nomeAba: string
): { campos: Partial<Record<CampoLogico, ValorCampo>>; pendenciasLinha: Pendencia[] } | null {
  const campos: Partial<Record<CampoLogico, ValorCampo>> = {}
  const pendenciasLinha: Pendencia[] = []
  let algumValor = false

  for (const [campo, col] of colunaDe) {
    const cel = ws[XLSX.utils.encode_cell({ r, c: col })]
    const bruto = cel ? cel.v : undefined
    if (bruto !== undefined && bruto !== null && bruto !== '') algumValor = true

    const res = parserDe(campo)(bruto)
    campos[campo] = res.valor

    // parseExito reporta o motivo dentro do próprio objeto.
    const motivo =
      res.motivo ??
      (res.valor && typeof res.valor === 'object' && 'motivo' in res.valor
        ? (res.valor as Exito).motivo
        : undefined)

    if (motivo) {
      pendenciasLinha.push({
        tipo: 'VALOR_NAO_PARSEAVEL',
        aba: nomeAba,
        linha: r + 1,
        campo,
        detalhe: motivo,
      })
    }
  }

  return algumValor ? { campos, pendenciasLinha } : null
}

/**
 * REGRA 9 — a aba GERAL não é importada, mas a equivalência dela com a união
 * das abas-carteira é RECONFERIDA a cada upload.
 *
 * A planilha é mantida à mão. Um mês em que alguém edite uma aba e esqueça a
 * outra faria GERAL e carteiras divergirem — e assumir a regra como eterna
 * esconderia isso.
 */
function verificarGeral(idsPorAba: Map<string, string[]>, pendencias: Pendencia[]) {
  const geral = idsPorAba.get('GERAL')
  if (!geral) return

  // Só as abas-CARTEIRA entram na comparação. A GERAL consolida os processos
  // ativos; BAIXADOS é uma lista à parte, de encerrados, e somá-la aqui
  // produziria divergência em todo upload — um alarme falso por mês ensina o
  // usuário a ignorar a tela de validação, que é o oposto do objetivo.
  const uniao: string[] = []
  for (const [aba, ids] of idsPorAba) {
    if (classificarAba(aba) !== 'CARTEIRA') continue
    uniao.push(...ids)
  }

  if (geral.length === uniao.length) return

  pendencias.push({
    tipo: 'GERAL_DIVERGENTE',
    aba: 'GERAL',
    detalhe:
      `A aba GERAL tem ${geral.length} processos, mas a união das abas-carteira ` +
      `tem ${uniao.length}. A GERAL não é importada, mas a diferença sugere que ` +
      'uma das abas foi editada sem a outra. Confira antes de confiar nos totais.',
  })
}
