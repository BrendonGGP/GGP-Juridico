/**
 * Busca no banco os dados do painel.
 *
 * Responsabilidade única: escolher a importação vigente, ler os snapshots e
 * delegar. Não calcula nada — o cálculo vive em `montar.ts`, compartilhado
 * com a origem planilha, e a tradução em `de-banco.ts`.
 *
 * A regra que só existe aqui: "a foto do mês" é a importação CONCLUÍDA mais
 * recente. Nunca uma EM_ANDAMENTO ou que FALHOU, cujos números estariam
 * parciais e passariam por completos.
 */

import { prisma } from '../db.ts'
import { montarPainel } from './montar.ts'
import { parcelasDeBanco, processosDeBanco } from './de-banco.ts'
import type { DadosPainel, ImportacaoVigente } from './tipos.ts'

/**
 * Cliente do banco usado nas leituras.
 *
 * É parâmetro para que uma verificação possa passar o cliente de uma
 * transação e ler o que ela gravou antes de desfazê-la. Em produção nunca é
 * informado: usa o singleton.
 */
type ClienteLeitura = Pick<typeof prisma, 'importacao' | 'processoSnapshot' | 'parcelaAcordo'>

const STATUS_CONCLUIDO = ['CONCLUIDA', 'CONCLUIDA_COM_PENDENCIAS'] as const

export async function importacaoVigente(
  mesReferencia?: string,
  db: ClienteLeitura = prisma
): Promise<ImportacaoVigente | null> {
  return db.importacao.findFirst({
    where: {
      status: { in: [...STATUS_CONCLUIDO] },
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
}

/** Meses disponíveis, do mais recente para o mais antigo. */
export async function mesesDisponiveis(db: ClienteLeitura = prisma): Promise<string[]> {
  const linhas = await db.importacao.findMany({
    where: { status: { in: [...STATUS_CONCLUIDO] } },
    select: { mesReferencia: true },
    distinct: ['mesReferencia'],
    orderBy: { mesReferencia: 'desc' },
  })
  return linhas.map(l => l.mesReferencia)
}

/**
 * Carrega o painel da importação vigente.
 *
 * Devolve `null` quando não há nenhuma importação concluída — estado legítimo
 * de sistema recém-instalado, que as telas tratam com uma mensagem em vez de
 * um painel de zeros.
 */
export async function carregarPainel(
  mesReferencia?: string,
  db: ClienteLeitura = prisma
): Promise<DadosPainel | null> {
  const importacao = await importacaoVigente(mesReferencia, db)
  if (!importacao) return null

  const snapshots = await db.processoSnapshot.findMany({
    where: { importacaoId: importacao.id },
    select: {
      processoId: true,
      encerrado: true,
      area: true,
      tipoAcao: true,
      risco: true,
      poloCliente: true,
      abaOrigem: true,
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
    },
  })

  // As parcelas vivem por processo, não por importação — uma parcela de
  // setembro enviada em julho continua valendo em agosto (REGRA 4, UPSERT).
  const parcelas = await db.parcelaAcordo.findMany({
    where: { processo: { snapshots: { some: { importacaoId: importacao.id } } } },
    select: { mesReferencia: true, valorParcela: true },
  })

  return montarPainel(
    processosDeBanco(snapshots),
    importacao,
    parcelasDeBanco(parcelas)
  )
}

export type { DadosPainel, ImportacaoVigente } from './tipos.ts'
