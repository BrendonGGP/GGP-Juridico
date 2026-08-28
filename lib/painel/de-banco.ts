/**
 * Adaptador: snapshots do banco -> entrada do motor de cálculo.
 *
 * Concentra a conversão `Decimal -> number`. O Prisma devolve `Decimal` para
 * os campos monetários (18,2) e o motor trabalha com `number`; espalhar essa
 * conversão convidaria um `Number(undefined)` virando NaN dentro de um total
 * de provisionamento — erro que passa por typecheck e só aparece na tela.
 *
 * O par deste módulo é `de-planilha.ts`. Os dois produzem o mesmo tipo, e é
 * por isso que o cálculo não precisa saber a origem do dado.
 */

import type { ParcelaParaCalculo, ProcessoParaCalculo } from './tipos.ts'

/**
 * Decimal do Prisma -> number. `null` continua `null`, nunca vira 0.
 *
 * A distinção importa: zero é uma afirmação sobre o processo ("não há valor a
 * pagar"); ausência de dado não é. Confundir os dois reduz o passivo em
 * silêncio.
 */
export function decimalParaNumero(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  // NaN aqui significaria dado corrompido virando número sem ninguém notar.
  return Number.isFinite(n) ? n : null
}

/** A forma do snapshot que este adaptador consome. */
export interface SnapshotParaCalculo {
  processoId: string
  encerrado: boolean
  area: string | null
  tipoAcao: string | null
  risco: 'PROVAVEL' | 'POSSIVEL' | 'REMOTO' | null
  poloCliente: string | null
  abaOrigem: string
  valorCausa: unknown
  valorAcordo: unknown
  valorCondenacao: unknown
  valorProvisionado: unknown
  resultadoSentenca: string | null
  motivoSinistro: string | null
  dataCadastro: Date | null
  dataEncerramento: Date | null
  processo: { numeroProcesso: string | null }
  mga: { nomeCanonico: string } | null
}

export function processosDeBanco(
  snapshots: SnapshotParaCalculo[]
): ProcessoParaCalculo[] {
  return snapshots.map(s => ({
    id: s.processoId,
    numeroProcesso: s.processo.numeroProcesso,
    carteira: s.abaOrigem,
    area: s.area,
    tipoAcao: s.tipoAcao,
    risco: s.risco,
    poloCliente: s.poloCliente,
    encerrado: s.encerrado,
    valorCausa: decimalParaNumero(s.valorCausa),
    valorAcordo: decimalParaNumero(s.valorAcordo),
    valorCondenacao: decimalParaNumero(s.valorCondenacao),
    valorProvisionado: decimalParaNumero(s.valorProvisionado),
    resultadoSentenca: s.resultadoSentenca,
    motivoSinistro: s.motivoSinistro,
    mga: s.mga?.nomeCanonico ?? null,
    dataCadastro: s.dataCadastro,
    dataEncerramento: s.dataEncerramento,
  }))
}

export function parcelasDeBanco(
  parcelas: { mesReferencia: string; valorParcela: unknown }[]
): ParcelaParaCalculo[] {
  return parcelas.map(p => ({
    mesReferencia: p.mesReferencia,
    valor: decimalParaNumero(p.valorParcela) ?? 0,
  }))
}
