/**
 * Indicadores estratégicos do Jurídico (§3.2 da especificação).
 *
 * Regra que atravessa o módulo: quando um indicador não tem base suficiente,
 * ele devolve `null` e diz por quê — nunca 0. Zero é uma afirmação sobre o
 * negócio ("não houve êxito", "não há processos"); ausência de dado não é.
 * Num painel de provisionamento, confundir os dois leva a decisão errada.
 */

import { calcularValorDevido } from './valor-devido.ts'
import { chaveComparacao } from '../ingestao/normalizar.ts'

export interface Indicador<T = number> {
  valor: T | null
  /** Preenchido quando `valor` é null. Aparece no lugar do número. */
  indisponivel?: string
  /** Quantos registros sustentam o número. */
  base: number
}

const semBase = <T>(motivo: string, base = 0): Indicador<T> => ({
  valor: null,
  indisponivel: motivo,
  base,
})

// ---------------------------------------------------------------------------
// 1. TAXA DE ÊXITO
// ---------------------------------------------------------------------------

export interface ProcessoParaExito {
  valorCausa: number | null
  valorAcordo: number | null
  valorCondenacao: number | null
  encerrado: boolean
  resultadoSentenca: string | null
}

export interface TaxaExito {
  /** Percentual do valor pedido que deixou de ser pago. */
  percentual: Indicador
  valorPedido: number
  valorDevido: number
  valorEconomizado: number
  processosComSentenca: number
}

/**
 * Valor que deixou de ser pago em relação ao valor pedido.
 *
 * REGRA 1: o valor devido usa acordo OU condenação, nunca a soma.
 *
 * Só entram processos com sentença — "Em andamento" não tem êxito a medir, e
 * incluí-los inflaria o percentual, porque a condenação ainda é zero.
 *
 * Este cálculo é DIFERENTE do campo `Êxito do processo` da planilha, que é
 * curado manualmente e nunca recalculado (REGRA 2). Aqui é o indicador
 * agregado da carteira; lá é o valor por processo, curado pelo escritório.
 */
export function calcularTaxaExito(processos: ProcessoParaExito[]): TaxaExito {
  const comSentenca = processos.filter(
    p => p.resultadoSentenca !== null && !ehEmAndamento(p.resultadoSentenca)
  )

  let valorPedido = 0
  let valorDevido = 0
  let base = 0

  for (const p of comSentenca) {
    if (p.valorCausa === null || p.valorCausa <= 0) continue
    valorPedido += p.valorCausa
    valorDevido += calcularValorDevido({
      valorAcordo: p.valorAcordo,
      valorCondenacao: p.valorCondenacao,
    }).valor
    base++
  }

  const valorEconomizado = valorPedido - valorDevido

  return {
    percentual:
      valorPedido > 0
        ? { valor: (valorEconomizado / valorPedido) * 100, base }
        : semBase('Sem processos com sentença e valor da causa informado.', base),
    valorPedido,
    valorDevido,
    valorEconomizado,
    processosComSentenca: base,
  }
}

function ehEmAndamento(resultado: string): boolean {
  return chaveComparacao(resultado).includes('em andamento')
}

// ---------------------------------------------------------------------------
// 2. REDUÇÃO DE ESTOQUE (burn-down)
// ---------------------------------------------------------------------------

export interface BurnDown {
  encerrados: number
  novos: number
  /** encerrados − novos. Positivo significa estoque diminuindo. */
  saldo: number
  /** Razão encerrados/novos. null quando não houve entrada no período. */
  razao: Indicador
}

/**
 * Encerramentos versus novas distribuições no período.
 *
 * `razao` fica indisponível quando não entrou processo novo: dividir por zero
 * produziria Infinity, e exibir "∞% de redução" num relatório executivo é pior
 * que dizer que o indicador não se aplica ao período.
 */
export function calcularBurnDown(encerrados: number, novos: number): BurnDown {
  return {
    encerrados,
    novos,
    saldo: encerrados - novos,
    razao:
      novos > 0
        ? { valor: encerrados / novos, base: novos }
        : semBase('Nenhum processo novo no período.', 0),
  }
}

// ---------------------------------------------------------------------------
// 3. TEMPO MÉDIO DE DURAÇÃO
// ---------------------------------------------------------------------------

export interface ProcessoParaDuracao {
  /** Validado com o Jurídico: a base é Data do cadastro, não Ajuizamento. */
  dataCadastro: Date | null
  dataEncerramento: Date | null
}

export interface TempoMedio {
  dias: Indicador
  meses: Indicador
  /** Menor e maior duração observadas, para dar contexto à média. */
  minimoDias: number | null
  maximoDias: number | null
  /** Duração no meio da distribuição — resiste a caso extremo. */
  medianaDias: number | null
}

const DIA_MS = 24 * 60 * 60 * 1000

/**
 * Intervalo entre Data do cadastro e Data do encerramento.
 *
 * Devolve mediana junto da média de propósito: uma carteira com um processo de
 * 15 anos distorce a média e sugere um tempo típico que não existe.
 */
export function calcularTempoMedio(processos: ProcessoParaDuracao[]): TempoMedio {
  const duracoes: number[] = []

  for (const p of processos) {
    if (!p.dataCadastro || !p.dataEncerramento) continue
    const dias = Math.round((p.dataEncerramento.getTime() - p.dataCadastro.getTime()) / DIA_MS)
    // Encerramento antes do cadastro é erro de dado, não duração negativa.
    if (dias < 0) continue
    duracoes.push(dias)
  }

  if (duracoes.length === 0) {
    return {
      dias: semBase('Nenhum processo com data de cadastro e de encerramento.'),
      meses: semBase('Nenhum processo com data de cadastro e de encerramento.'),
      minimoDias: null,
      maximoDias: null,
      medianaDias: null,
    }
  }

  duracoes.sort((a, b) => a - b)
  const soma = duracoes.reduce((s, d) => s + d, 0)
  const media = soma / duracoes.length
  const meio = Math.floor(duracoes.length / 2)
  const mediana =
    duracoes.length % 2 === 0 ? (duracoes[meio - 1] + duracoes[meio]) / 2 : duracoes[meio]

  return {
    dias: { valor: media, base: duracoes.length },
    meses: { valor: media / 30.44, base: duracoes.length },
    minimoDias: duracoes[0],
    maximoDias: duracoes[duracoes.length - 1],
    medianaDias: mediana,
  }
}

// ---------------------------------------------------------------------------
// 4. ÍNDICE DE RECORRÊNCIA
// ---------------------------------------------------------------------------

export interface ItemRecorrencia {
  rotulo: string
  quantidade: number
  percentual: number
}

/**
 * Qual assunto/motivo mais gerou processos.
 *
 * Agrupa por chave normalizada — sem isso, "Colisão" e "colisão " apareceriam
 * como motivos distintos — mas exibe a grafia mais frequente, para o relatório
 * mostrar o texto como o Jurídico escreve.
 */
export function calcularRecorrencia(
  valores: (string | null)[],
  limite = 10
): { itens: ItemRecorrencia[]; total: number; semClassificacao: number } {
  const grupos = new Map<string, { quantidade: number; grafias: Map<string, number> }>()
  let semClassificacao = 0

  for (const v of valores) {
    if (v === null || v.trim() === '') {
      semClassificacao++
      continue
    }
    const k = chaveComparacao(v)
    const g = grupos.get(k) ?? { quantidade: 0, grafias: new Map() }
    g.quantidade++
    g.grafias.set(v.trim(), (g.grafias.get(v.trim()) ?? 0) + 1)
    grupos.set(k, g)
  }

  const total = [...grupos.values()].reduce((s, g) => s + g.quantidade, 0)

  const itens = [...grupos.values()]
    .map(g => ({
      rotulo: [...g.grafias.entries()].sort((a, b) => b[1] - a[1])[0][0],
      quantidade: g.quantidade,
      percentual: total > 0 ? (g.quantidade / total) * 100 : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade || a.rotulo.localeCompare(b.rotulo))
    .slice(0, limite)

  return { itens, total, semClassificacao }
}

// ---------------------------------------------------------------------------
// 5. APLICAÇÃO E EFEITO DE NOVAS TESES
// ---------------------------------------------------------------------------

export interface ProcessoParaTese {
  motivoSinistro: string | null
  resultadoSentenca: string | null
  /**
   * Ativa | Passiva | Outros. Decide o que significa "procedente".
   *
   * No polo PASSIVO (726 dos 799 processos reais) somos réus: improcedência
   * do pedido do autor é VITÓRIA nossa. No polo ATIVO somos autores, e aí é o
   * contrário. Ignorar isso inverteria o resultado de ~71 processos e faria o
   * indicador apontar a tese errada como vencedora.
   */
  poloCliente: string | null
}

/** Ganhamos quando o pedido do adversário é rejeitado — ou o nosso, aceito. */
function classificarResultado(
  resultado: string,
  polo: string | null
): 'ganho' | 'perda' | 'parcial' | 'outro' {
  const r = chaveComparacao(resultado)
  if (r.includes('parcialmente')) return 'parcial'

  const noPoloAtivo = polo !== null && chaveComparacao(polo).startsWith('ativ')

  if (r.includes('improcedente')) return noPoloAtivo ? 'perda' : 'ganho'
  if (r.includes('procedente')) return noPoloAtivo ? 'ganho' : 'perda'
  return 'outro'
}

export interface EfeitoTese {
  motivo: string
  ganhos: number
  perdas: number
  parciais: number
  outros: number
  total: number
  /** Percentual de vitórias entre os casos decididos. null se não houve decisão. */
  taxaGanho: Indicador
}

/**
 * Em quais motivos de negativa de sinistro o Jurídico ganha ou perde.
 *
 * Cruza `Motivo do Sinistro` com `Resultado (Sentença)`, conforme a resposta do
 * Jurídico em 20/08/2026. Serve para identificar quais teses funcionam.
 *
 * "Parcialmente Procedente" é contado à parte, não como ganho nem como perda:
 * forçá-lo para um dos lados distorceria justamente o indicador que existe
 * para orientar estratégia jurídica.
 */
export function calcularEfeitoTeses(
  processos: ProcessoParaTese[],
  minimoOcorrencias = 3
): EfeitoTese[] {
  const porMotivo = new Map<string, { rotulo: string; itens: ProcessoParaTese[] }>()

  for (const p of processos) {
    if (!p.motivoSinistro || p.motivoSinistro.trim() === '') continue
    if (!p.resultadoSentenca) continue
    const k = chaveComparacao(p.motivoSinistro)
    const g = porMotivo.get(k) ?? { rotulo: p.motivoSinistro.trim(), itens: [] }
    g.itens.push(p)
    porMotivo.set(k, g)
  }

  const resultado: EfeitoTese[] = []

  for (const g of porMotivo.values()) {
    // Motivo com 1 ou 2 casos não sustenta conclusão sobre tese.
    if (g.itens.length < minimoOcorrencias) continue

    let ganhos = 0
    let perdas = 0
    let parciais = 0
    let outros = 0

    for (const p of g.itens) {
      switch (classificarResultado(p.resultadoSentenca!, p.poloCliente)) {
        case 'ganho': ganhos++; break
        case 'perda': perdas++; break
        case 'parcial': parciais++; break
        default: outros++
      }
    }

    const decididos = ganhos + perdas
    resultado.push({
      motivo: g.rotulo,
      ganhos,
      perdas,
      parciais,
      outros,
      total: g.itens.length,
      taxaGanho:
        decididos > 0
          ? { valor: (ganhos / decididos) * 100, base: decididos }
          : semBase('Nenhum caso com decisão definitiva neste motivo.', g.itens.length),
    })
  }

  return resultado.sort((a, b) => b.total - a.total || a.motivo.localeCompare(b.motivo))
}

// ---------------------------------------------------------------------------
// 6. CONCENTRAÇÃO POR M.G.A
// ---------------------------------------------------------------------------

/**
 * Qual representante de seguros concentra mais demanda judicial.
 *
 * Relatório sugerido no roadmap herdado, para decisão estratégica de suporte
 * ou treinamento ao parceiro.
 */
export function calcularConcentracaoMga(
  mgas: (string | null)[],
  limite = 10
): { itens: ItemRecorrencia[]; semMga: number } {
  const r = calcularRecorrencia(mgas, limite)
  return { itens: r.itens, semMga: r.semClassificacao }
}
