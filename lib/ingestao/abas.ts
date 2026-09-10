/**
 * Classificação das abas da planilha.
 *
 * Lista de PERMISSÃO, nunca de exclusão: aba desconhecida gera aviso e não é
 * ingerida em silêncio. Se o escritório criar uma carteira nova, queremos
 * descobrir por um alerta, não por um número que não fecha três meses depois.
 */

import { chaveComparacao } from './normalizar.ts'

export type TipoAba =
  /** Consolidação das demais. REGRA 9: não é importada, mas é reconferida. */
  | 'GERAL'
  /** Aba de carteira/empresa com processos ativos. */
  | 'CARTEIRA'
  /** Processos encerrados. REGRA 8: vence a aba ativa em caso de conflito. */
  | 'BAIXADOS'
  /** Planilha de acordos, com os pares dinâmicos de mês. */
  | 'ACORDOS'
  /** Não reconhecida. Vira pendência para revisão humana. */
  | 'DESCONHECIDA'

/**
 * Abas-carteira conhecidas, por PADRÃO e não por nome exato.
 *
 * Motivo, aprendido em agosto/2026: comparar o nome inteiro fez três abas
 * legítimas caírem como DESCONHECIDA porque o escritório as renomeou —
 *
 *   'DEMAIS SEVEN, PEDRO, FABIANA...'  ->  'DEMAIS SEVEN, PEDRO, SAMUEL...'
 *   'REGRESSIVAS DE COBRANÇA - SPLIT'  ->  'REGRESSIVAS SPLIT RISK'
 *   'SEVEN INSURTECH'                  ->  'INSURTECH'
 *
 * O resultado foi uma base com 343 processos em vez de ~800: número menor,
 * com cara de correto. A aba BAIXADOS já era reconhecida por substring pelo
 * mesmo motivo; o resto ficou para trás.
 *
 * Cada padrão identifica a carteira pelo que NÃO muda — o nome do parceiro —
 * e não pela redação completa. Continua sendo lista de PERMISSÃO: aba que não
 * casa com nenhum padrão vira pendência, nunca é ingerida em silêncio.
 */
interface PadraoCarteira {
  /** Reconhecido quando TODOS os termos aparecem no nome normalizado. */
  termos: string[]
  /** Mistura vários clientes e exige desmembramento pela coluna Cliente. */
  multiCliente?: boolean
}

const PADROES_CARTEIRA: PadraoCarteira[] = [
  // "DEMAIS SEVEN, PEDRO, ..." — os nomes após "DEMAIS" mudam a cada mês.
  // NÃO é uma empresa: mistura 8 clientes (seção 6.2 da especificação).
  { termos: ['demais'], multiCliente: true },

  // "REGRESSIVAS ..." precede a checagem de "split", que também casaria com
  // a seguradora. A ordem deste array importa: o primeiro padrão vence.
  { termos: ['regressivas'] },

  { termos: ['split'] },
  { termos: ['insurtech'] },
]

/** Primeiro padrão que reconhece a aba, ou null. */
function padraoDaAba(nome: string): PadraoCarteira | null {
  const k = chaveComparacao(nome)
  return PADROES_CARTEIRA.find(p => p.termos.every(t => k.includes(t))) ?? null
}

export function classificarAba(nome: string): TipoAba {
  const k = chaveComparacao(nome)

  if (k === 'geral') return 'GERAL'

  // Por SUBSTRING de propósito: a aba mudou de nome entre os meses reais
  // ("BAIXADOS ÚLTIMO SEMESTRE" em junho -> "BAIXADOS ULTIMOS 3 MESES" em
  // julho) e provavelmente mudará de novo.
  if (k.includes('baixados')) return 'BAIXADOS'

  if (k.includes('acordos')) return 'ACORDOS'

  if (padraoDaAba(nome)) return 'CARTEIRA'

  return 'DESCONHECIDA'
}

/** A aba mistura clientes distintos e precisa ser quebrada pela coluna Cliente? */
export function exigeDesmembramento(nome: string): boolean {
  return padraoDaAba(nome)?.multiCliente === true
}

/**
 * Nome de carteira a usar quando a aba representa uma empresa só.
 * Para abas multi-cliente, o nome vem da coluna Cliente de cada linha.
 */
export function carteiraDaAba(nome: string): string | null {
  return exigeDesmembramento(nome) ? null : nome.trim()
}
