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
 * Abas-carteira conhecidas, em julho/2026.
 *
 * `DEMAIS SEVEN, PEDRO, FABIANA...` NÃO é uma empresa: mistura 8 clientes e
 * precisa ser desmembrada pela coluna Cliente (ver seção 6.2 da especificação).
 */
const CARTEIRAS_CONHECIDAS = [
  'DEMAIS SEVEN, PEDRO, FABIANA...',
  'SPLIT RISK SEGURADORA S.A',
  'REGRESSIVAS DE COBRANÇA - SPLIT',
  'SEVEN INSURTECH',
]

const CARTEIRAS_NORMALIZADAS = new Set(CARTEIRAS_CONHECIDAS.map(chaveComparacao))

/** Abas-carteira que misturam mais de um cliente e exigem desmembramento. */
const MULTI_CLIENTE = new Set([chaveComparacao('DEMAIS SEVEN, PEDRO, FABIANA...')])

export function classificarAba(nome: string): TipoAba {
  const k = chaveComparacao(nome)

  if (k === 'geral') return 'GERAL'

  // Por SUBSTRING de propósito: a aba mudou de nome entre os meses reais
  // ("BAIXADOS ÚLTIMO SEMESTRE" em junho -> "BAIXADOS ULTIMOS 3 MESES" em
  // julho) e provavelmente mudará de novo.
  if (k.includes('baixados')) return 'BAIXADOS'

  if (k.includes('acordos')) return 'ACORDOS'

  if (CARTEIRAS_NORMALIZADAS.has(k)) return 'CARTEIRA'

  return 'DESCONHECIDA'
}

/** A aba mistura clientes distintos e precisa ser quebrada pela coluna Cliente? */
export function exigeDesmembramento(nome: string): boolean {
  return MULTI_CLIENTE.has(chaveComparacao(nome))
}

/**
 * Nome de carteira a usar quando a aba representa uma empresa só.
 * Para abas multi-cliente, o nome vem da coluna Cliente de cada linha.
 */
export function carteiraDaAba(nome: string): string | null {
  return exigeDesmembramento(nome) ? null : nome.trim()
}
