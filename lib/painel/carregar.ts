/**
 * Camada de dados do painel: do banco para o motor de cálculo.
 *
 * Existe para que as telas nunca falem com o Prisma diretamente. Elas recebem
 * o resultado já calculado pelos módulos de `lib/calculo`, que são os únicos
 * autorizados a interpretar valor.
 *
 * Duas responsabilidades que só existem aqui:
 *
 *  1. **Decimal → number.** O Prisma devolve `Decimal` para os campos
 *     monetários (18,2). O motor de cálculo trabalha com `number`. A conversão
 *     acontece num lugar só; espalhá-la seria convidar um `Number(undefined)`
 *     virando NaN dentro de um total de provisionamento.
 *
 *  2. **Escolher a importação vigente.** "A foto do mês" é a importação
 *     CONCLUÍDA mais recente — nunca uma EM_ANDAMENTO ou que FALHOU, cujos
 *     números estariam parciais. REGRA 6: as anteriores continuam lá.
 */

import { prisma } from '../db.ts'
import { calcularTodosCenarios, type Cenario } from '../calculo/cenarios.ts'
import { calcularProjecao } from '../calculo/projecao.ts'
import { calcularTop } from '../calculo/top-processos.ts'
import {
  calcularTaxaExito,
  calcularTempoMedio,
  calcularRecorrencia,
  calcularEfeitoTeses,
  calcularConcentracaoMga,
} from '../calculo/kpis.ts'

/** Decimal do Prisma → number. null continua null (nunca vira 0). */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  // NaN aqui significaria dado corrompido virando número silenciosamente.
  return Number.isFinite(n) ? n : null
}

export interface ImportacaoVigente {
  id: string
  mesReferencia: string
  concluidaEm: Date | null
  arquivoGeralNome: string | null
  totalPendencias: number
}

/**
 * A importação que o painel deve mostrar.
 *
 * Só considera status concluído. Se a última tentativa falhou, o painel
 * continua mostrando o último mês bom — com a data à vista, para ninguém
 * confundir dado velho com dado atual.
 */
export async function importacaoVigente(
  mesReferencia?: string
): Promise<ImportacaoVigente | null> {
  const imp = await prisma.importacao.findFirst({
    where: {
      status: { in: ['CONCLUIDA', 'CONCLUIDA_COM_PENDENCIAS'] },
      ...(mesReferencia ? { mesReferencia } : {}),
    },
    orderBy: [{ mesReferencia: 'desc' }, { concluidaEm: 'desc' }],
    select: {
      id: true,
      mesReferencia: true,
      concluidaEm: true,
      arquivoGeralNome: true,
      totalPendencias: true,
    },
  })
  return imp
}

/** Meses disponíveis, do mais recente para o mais antigo. */
export async function mesesDisponiveis(): Promise<string[]> {
  const linhas = await prisma.importacao.findMany({
    where: { status: { in: ['CONCLUIDA', 'CONCLUIDA_COM_PENDENCIAS'] } },
    select: { mesReferencia: true },
    distinct: ['mesReferencia'],
    orderBy: { mesReferencia: 'desc' },
  })
  return linhas.map(l => l.mesReferencia)
}

export interface DadosPainel {
  importacao: ImportacaoVigente
  totalProcessos: number
  cenarios: ReturnType<typeof calcularTodosCenarios>
  projecao: ReturnType<typeof calcularProjecao>
  top: ReturnType<typeof calcularTop>
  exito: ReturnType<typeof calcularTaxaExito>
  tempo: ReturnType<typeof calcularTempoMedio>
  recorrencia: ReturnType<typeof calcularRecorrencia>
  teses: ReturnType<typeof calcularEfeitoTeses>
  mga: ReturnType<typeof calcularConcentracaoMga>
}

/**
 * Carrega os snapshots da importação vigente e roda todo o motor de cálculo.
 *
 * Devolve `null` quando ainda não há nenhuma importação concluída — estado
 * legítimo de sistema recém-instalado, que as telas tratam com uma mensagem
 * em vez de um painel de zeros.
 */
export async function carregarPainel(mesReferencia?: string): Promise<DadosPainel | null> {
  const importacao = await importacaoVigente(mesReferencia)
  if (!importacao) return null

  const snapshots = await prisma.processoSnapshot.findMany({
    where: { importacaoId: importacao.id },
    select: {
      processoId: true,
      encerrado: true,
      area: true,
      tipoAcao: true,
      risco: true,
      poloCliente: true,
      valorProvisionado: true,
      valorCausa: true,
      valorAcordo: true,
      valorCondenacao: true,
      resultadoSentenca: true,
      motivoSinistro: true,
      dataCadastro: true,
      dataEncerramento: true,
      processo: { select: { numeroProcesso: true } },
      mga: { select: { nomeCanonico: true } },
      abaOrigem: true,
    },
  })

  // As parcelas vivem por processo, não por importação — uma parcela de
  // setembro enviada em julho continua valendo em agosto (REGRA 4, UPSERT).
  const parcelas = await prisma.parcelaAcordo.findMany({
    where: { processo: { snapshots: { some: { importacaoId: importacao.id } } } },
    select: { mesReferencia: true, valorParcela: true },
  })

  const cenarios = calcularTodosCenarios(
    snapshots.map(s => ({
      risco: s.risco,
      valorProvisionado: num(s.valorProvisionado),
      encerrado: s.encerrado,
    }))
  )

  const projecao = calcularProjecao(
    parcelas
      .map(p => ({ mesReferencia: p.mesReferencia, valor: num(p.valorParcela) ?? 0 }))
      .filter(p => p.valor > 0),
    importacao.mesReferencia
  )

  const top = calcularTop(
    snapshots.map(s => ({
      id: s.processoId,
      numeroProcesso: s.processo.numeroProcesso,
      carteira: s.abaOrigem,
      area: s.area,
      tipoAcao: s.tipoAcao,
      risco: s.risco,
      encerrado: s.encerrado,
      valorCausa: num(s.valorCausa),
      valorAcordo: num(s.valorAcordo),
      valorCondenacao: num(s.valorCondenacao),
      valorProvisionado: num(s.valorProvisionado),
    }))
  )

  const exito = calcularTaxaExito(
    snapshots.map(s => ({
      valorCausa: num(s.valorCausa),
      valorAcordo: num(s.valorAcordo),
      valorCondenacao: num(s.valorCondenacao),
      encerrado: s.encerrado,
      resultadoSentenca: s.resultadoSentenca,
    }))
  )

  const tempo = calcularTempoMedio(
    snapshots.map(s => ({
      dataCadastro: s.dataCadastro,
      dataEncerramento: s.dataEncerramento,
    }))
  )

  const recorrencia = calcularRecorrencia(snapshots.map(s => s.tipoAcao), 8)

  const teses = calcularEfeitoTeses(
    snapshots.map(s => ({
      motivoSinistro: s.motivoSinistro,
      resultadoSentenca: s.resultadoSentenca,
      poloCliente: s.poloCliente,
    }))
  )

  const mga = calcularConcentracaoMga(
    snapshots.map(s => s.mga?.nomeCanonico ?? null),
    8
  )

  return {
    importacao,
    totalProcessos: snapshots.length,
    cenarios,
    projecao,
    top,
    exito,
    tempo,
    recorrencia,
    teses,
    mga,
  }
}

export type { Cenario }
