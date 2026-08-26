/**
 * Orquestração da importação mensal.
 *
 * Fluxo em DOIS passos, deliberadamente:
 *
 *   1. `prepararImportacao` — valida, lê, consolida e devolve um PREVIEW com
 *      contagens e pendências. Não grava nada.
 *   2. `confirmarImportacao` — grava, dentro de uma transação.
 *
 * A separação existe porque a importação é L3 na política de aprovação
 * (seguranca/politica-aprovacao-humana.yaml): o humano precisa ver o que vai
 * acontecer — quantos processos, quantas parcelas, quantas pendências — antes
 * de autorizar. Um botão único que lê e grava de uma vez não daria essa chance.
 */

import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { validarUpload, validarEstrutura, type ResultadoValidacao } from './validar-upload.ts'
import { lerPlanilha, type Pendencia } from './ler-planilha.ts'
import {
  consolidar,
  mesclarAcordos,
  type RegistroConsolidado,
  type ItemReconciliacao,
} from './consolidar.ts'
import { gravarImportacao, type ResultadoGravacao } from './gravar.ts'

export interface ArquivoEnviado {
  nome: string
  conteudo: Buffer
}

export interface EntradaPreparacao {
  /** "2026-07" — mês de referência informado pelo usuário. */
  mesReferencia: string
  relatorioGeral: ArquivoEnviado
  /** Opcional: nem todo mês vem com planilha de acordos nova. */
  acordos?: ArquivoEnviado
}

export interface Preparacao {
  ok: boolean
  /** Motivos da recusa. Quando presente, nada mais foi processado. */
  erros: string[]
  avisos: string[]
  /** Chave que torna o reenvio do MESMO arquivo um no-op. */
  idempotencyKey: string
  mesReferencia: string
  hashGeral: string
  hashAcordos: string | null
  registros: RegistroConsolidado[]
  pendencias: Pendencia[]
  reconciliacao: ItemReconciliacao[]
  orfaos: RegistroConsolidado[]
  resumo: ResumoPreparacao
}

export interface ResumoPreparacao {
  abas: { nome: string; tipo: string; linhas: number }[]
  totalRegistros: number
  ativos: number
  encerrados: number
  comParcelas: number
  totalParcelas: number
  mesesDeParcela: string[]
  totalPendencias: number
  pendenciasPorTipo: { tipo: string; quantidade: number }[]
  reconciliacaoParaRevisar: number
  reconciliacaoExplicada: number
  acordosOrfaos: number
}

function sha256(b: Buffer): string {
  return createHash('sha256').update(b).digest('hex')
}

function juntar(...rs: ResultadoValidacao[]): ResultadoValidacao {
  return {
    ok: rs.every(r => r.ok),
    erros: rs.flatMap(r => r.erros),
    avisos: rs.flatMap(r => r.avisos),
  }
}

const vazia = (
  erros: string[],
  avisos: string[],
  mesReferencia: string
): Preparacao => ({
  ok: false,
  erros,
  avisos,
  idempotencyKey: '',
  mesReferencia,
  hashGeral: '',
  hashAcordos: null,
  registros: [],
  pendencias: [],
  reconciliacao: [],
  orfaos: [],
  resumo: {
    abas: [],
    totalRegistros: 0,
    ativos: 0,
    encerrados: 0,
    comParcelas: 0,
    totalParcelas: 0,
    mesesDeParcela: [],
    totalPendencias: 0,
    pendenciasPorTipo: [],
    reconciliacaoParaRevisar: 0,
    reconciliacaoExplicada: 0,
    acordosOrfaos: 0,
  },
})

/** Passo 1: valida, lê e consolida. NÃO grava. */
export function prepararImportacao(entrada: EntradaPreparacao): Preparacao {
  if (!/^\d{4}-\d{2}$/.test(entrada.mesReferencia)) {
    return vazia(
      [`Mês de referência inválido: ${JSON.stringify(entrada.mesReferencia)}. Use AAAA-MM.`],
      [],
      entrada.mesReferencia
    )
  }

  const vGeral = validarUpload(entrada.relatorioGeral.nome, entrada.relatorioGeral.conteudo)
  const vAcordos = entrada.acordos
    ? validarUpload(entrada.acordos.nome, entrada.acordos.conteudo)
    : { ok: true, erros: [], avisos: [] }

  const validacao = juntar(vGeral, vAcordos)
  if (!validacao.ok) {
    return vazia(validacao.erros, validacao.avisos, entrada.mesReferencia)
  }

  const lidoGeral = lerPlanilha(entrada.relatorioGeral.conteudo)
  const vEstrutura = validarEstrutura(
    lidoGeral.abasLidas.map(a => ({ nome: a.nome, linhas: a.linhas }))
  )
  if (!vEstrutura.ok) {
    return vazia(vEstrutura.erros, [...validacao.avisos, ...vEstrutura.avisos], entrada.mesReferencia)
  }

  const consGeral = consolidar(lidoGeral.linhas)

  let registros = consGeral.registros
  let pendencias = [...lidoGeral.pendencias, ...consGeral.pendencias]
  let orfaos: RegistroConsolidado[] = []
  let mesesDeParcela: string[] = []

  if (entrada.acordos) {
    const lidoAcordos = lerPlanilha(entrada.acordos.conteudo)
    const consAcordos = consolidar(lidoAcordos.linhas)
    const mesclado = mesclarAcordos(registros, consAcordos.registros)
    registros = mesclado.registros
    orfaos = mesclado.orfaos
    pendencias = [...pendencias, ...lidoAcordos.pendencias, ...consAcordos.pendencias]
    mesesDeParcela = lidoAcordos.mesesDetectados
  }

  const hashGeral = sha256(entrada.relatorioGeral.conteudo)
  const hashAcordos = entrada.acordos ? sha256(entrada.acordos.conteudo) : null

  // A chave amarra mês + conteúdo dos dois arquivos. Reenviar exatamente os
  // mesmos arquivos para o mesmo mês é no-op; qualquer byte diferente é uma
  // importação nova, que gera um snapshot próprio.
  const idempotencyKey = createHash('sha256')
    .update(`${entrada.mesReferencia}|${hashGeral}|${hashAcordos ?? '-'}`)
    .digest('hex')

  return {
    ok: true,
    erros: [],
    avisos: validacao.avisos,
    idempotencyKey,
    mesReferencia: entrada.mesReferencia,
    hashGeral,
    hashAcordos,
    registros,
    pendencias,
    reconciliacao: consGeral.reconciliacao,
    orfaos,
    resumo: montarResumo(lidoGeral.abasLidas, registros, pendencias, consGeral.reconciliacao, orfaos, mesesDeParcela),
  }
}

function montarResumo(
  abas: { nome: string; tipo: string; linhas: number }[],
  registros: RegistroConsolidado[],
  pendencias: Pendencia[],
  reconciliacao: ItemReconciliacao[],
  orfaos: RegistroConsolidado[],
  mesesDeParcela: string[]
): ResumoPreparacao {
  const todas = [...pendencias, ...registros.flatMap(r => r.pendencias)]
  const porTipo = new Map<string, number>()
  for (const p of todas) porTipo.set(p.tipo, (porTipo.get(p.tipo) ?? 0) + 1)

  return {
    abas,
    totalRegistros: registros.length,
    ativos: registros.filter(r => !r.encerrado).length,
    encerrados: registros.filter(r => r.encerrado).length,
    comParcelas: registros.filter(r => r.parcelas.length > 0).length,
    totalParcelas: registros.reduce((s, r) => s + r.parcelas.length, 0),
    mesesDeParcela,
    totalPendencias: todas.length,
    pendenciasPorTipo: [...porTipo.entries()]
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade),
    reconciliacaoParaRevisar: reconciliacao.filter(r => !r.explicadoPorIdpj).length,
    reconciliacaoExplicada: reconciliacao.filter(r => r.explicadoPorIdpj).length,
    acordosOrfaos: orfaos.length,
  }
}

export interface EntradaConfirmacao {
  preparacao: Preparacao
  usuarioId?: string
  nomeGeral: string
  nomeAcordos?: string
  /** Executa e desfaz, devolvendo as contagens do preview. */
  dryRun?: boolean
}

/** Passo 2: grava, transacionalmente. */
export async function confirmarImportacao(
  prisma: PrismaClient,
  entrada: EntradaConfirmacao
): Promise<ResultadoGravacao> {
  const p = entrada.preparacao
  if (!p.ok) {
    throw new Error('Preparação inválida — a importação não pode ser confirmada.')
  }

  return gravarImportacao(prisma, {
    mesReferencia: p.mesReferencia,
    idempotencyKey: p.idempotencyKey,
    registros: p.registros,
    pendencias: p.pendencias,
    reconciliacao: p.reconciliacao,
    orfaos: p.orfaos,
    usuarioId: entrada.usuarioId,
    arquivoGeralNome: entrada.nomeGeral,
    arquivoGeralHash: p.hashGeral,
    arquivoAcordosNome: entrada.nomeAcordos,
    arquivoAcordosHash: p.hashAcordos ?? undefined,
    dryRun: entrada.dryRun,
  })
}
