/**
 * Gravação transacional de uma importação.
 *
 * Desenhado em torno do fato central deste sistema: **toda planilha é
 * reenviada**. Todo mês chega um arquivo novo que repete meses já recebidos.
 * Cada decisão aqui existe para que reenviar seja seguro:
 *
 *   - REGRA 6: cada importação vira um SNAPSHOT novo. O histórico nunca é
 *     sobrescrito, então comparar meses continua possível.
 *   - REGRA 4: parcelas usam UPSERT por (processo, mês de referência). Sem
 *     isso, cada reenvio somaria parcela em cima da existente e a Projeção de
 *     Desembolso inflaria em silêncio.
 *   - REGRA 5: o processo é reencontrado pela chave de identidade, então o
 *     mesmo processo de julho e de agosto é a MESMA linha em `processo`.
 *   - Idempotência: reenviar o MESMO arquivo não cria um segundo snapshot.
 *
 * Tudo roda numa transação. `dryRun` executa e desfaz, para o preview.
 */

import type { PrismaClient, Prisma } from '@prisma/client'
import type { RegistroConsolidado } from './consolidar.ts'
import type { Pendencia } from './ler-planilha.ts'
import type { ItemReconciliacao } from './consolidar.ts'

export interface EntradaGravacao {
  /** "2026-07" — mês de referência da planilha, não a data do upload. */
  mesReferencia: string
  /** Hash do conteúdo dos arquivos. Reenviar o mesmo arquivo é no-op. */
  idempotencyKey: string
  registros: RegistroConsolidado[]
  pendencias: Pendencia[]
  reconciliacao: ItemReconciliacao[]
  orfaos: RegistroConsolidado[]
  usuarioId?: string
  arquivoGeralNome?: string
  arquivoGeralHash?: string
  arquivoAcordosNome?: string
  arquivoAcordosHash?: string
  /** Executa tudo e desfaz ao final. Para o preview antes de aprovar. */
  dryRun?: boolean
}

export interface ResultadoGravacao {
  importacaoId: string | null
  /** true quando este arquivo já havia sido importado antes. */
  jaImportado: boolean
  dryRun: boolean
  processosNovos: number
  processosAtualizados: number
  snapshotsGravados: number
  parcelasInseridas: number
  parcelasAtualizadas: number
  pendenciasGravadas: number
}

/** Sentinela para abortar a transação do dry-run sem sinalizar erro real. */
const ROLLBACK_DRY_RUN = Symbol('rollback-dry-run')

export async function gravarImportacao(
  prisma: PrismaClient,
  entrada: EntradaGravacao
): Promise<ResultadoGravacao> {
  const dryRun = entrada.dryRun ?? false

  // Idempotência fora da transação: reenviar o mesmo arquivo não deve nem
  // começar a escrever.
  const existente = await prisma.importacao.findUnique({
    where: { idempotencyKey: entrada.idempotencyKey },
  })
  if (existente) {
    return {
      importacaoId: existente.id,
      jaImportado: true,
      dryRun,
      processosNovos: 0,
      processosAtualizados: 0,
      snapshotsGravados: 0,
      parcelasInseridas: 0,
      parcelasAtualizadas: 0,
      pendenciasGravadas: 0,
    }
  }

  try {
    return await prisma.$transaction(
      async tx => {
        const resultado = await executar(tx, entrada, dryRun)
        if (dryRun) throw ROLLBACK_DRY_RUN
        return resultado
      },
      { timeout: 120_000 }
    )
  } catch (e) {
    if (e === ROLLBACK_DRY_RUN) {
      // A transação foi desfeita de propósito. Reexecuta em memória apenas
      // para devolver as contagens do preview.
      return { ...(await simular(prisma, entrada)), dryRun: true }
    }
    throw e
  }
}

type Tx = Prisma.TransactionClient

async function executar(
  tx: Tx,
  entrada: EntradaGravacao,
  dryRun: boolean
): Promise<ResultadoGravacao> {
  const importacao = await tx.importacao.create({
    data: {
      mesReferencia: entrada.mesReferencia,
      idempotencyKey: entrada.idempotencyKey,
      status: 'EM_ANDAMENTO',
      usuarioId: entrada.usuarioId ?? null,
      arquivoGeralNome: entrada.arquivoGeralNome ?? null,
      arquivoGeralHash: entrada.arquivoGeralHash ?? null,
      arquivoAcordosNome: entrada.arquivoAcordosNome ?? null,
      arquivoAcordosHash: entrada.arquivoAcordosHash ?? null,
      totalLinhasLidas: entrada.registros.length,
    },
  })

  let processosNovos = 0
  let processosAtualizados = 0
  let snapshotsGravados = 0
  let parcelasInseridas = 0
  let parcelasAtualizadas = 0

  const clientes = await garantirClientes(tx, entrada.registros)

  for (const reg of entrada.registros) {
    // REGRA 5: reencontra o processo de meses anteriores pela identidade.
    const anterior = await tx.processo.findUnique({
      where: { chaveIdentidade: reg.chaveIdentidade },
      select: { id: true },
    })

    const processo = await tx.processo.upsert({
      where: { chaveIdentidade: reg.chaveIdentidade },
      create: {
        chaveIdentidade: reg.chaveIdentidade,
        numeroProcesso: reg.numeroProcesso,
        fichaExterna: reg.ficha,
        clienteId: reg.carteira ? clientes.get(reg.carteira) ?? null : null,
      },
      update: {
        // O processo pode ter ganhado número real depois de "A DISTRIBUIR".
        numeroProcesso: reg.numeroProcesso,
        fichaExterna: reg.ficha,
        clienteId: reg.carteira ? clientes.get(reg.carteira) ?? null : null,
      },
      select: { id: true },
    })

    if (anterior) processosAtualizados++
    else processosNovos++

    // REGRA 6: snapshot NOVO, sempre. Nunca sobrescreve o mês anterior.
    await tx.processoSnapshot.create({
      data: {
        importacaoId: importacao.id,
        processoId: processo.id,
        abaOrigem: reg.origem.aba,
        encerrado: reg.encerrado,
        ...mapearCampos(reg),
      },
    })
    snapshotsGravados++

    // REGRA 4: UPSERT por (processo, mês). O reenvio ATUALIZA, não duplica.
    for (const p of reg.parcelas) {
      const jaExistia = await tx.parcelaAcordo.findUnique({
        where: {
          processoId_mesReferencia: {
            processoId: processo.id,
            mesReferencia: p.mesReferencia,
          },
        },
        select: { id: true },
      })

      await tx.parcelaAcordo.upsert({
        where: {
          processoId_mesReferencia: {
            processoId: processo.id,
            mesReferencia: p.mesReferencia,
          },
        },
        create: {
          processoId: processo.id,
          mesReferencia: p.mesReferencia,
          dataPagamento: p.dataPagamento,
          valorParcela: p.valor,
          importacaoId: importacao.id,
        },
        update: {
          dataPagamento: p.dataPagamento,
          valorParcela: p.valor,
          importacaoId: importacao.id,
        },
      })

      if (jaExistia) parcelasAtualizadas++
      else parcelasInseridas++
    }
  }

  const pendenciasGravadas = await gravarPendencias(tx, importacao.id, entrada)

  await tx.importacao.update({
    where: { id: importacao.id },
    data: {
      status: pendenciasGravadas > 0 ? 'CONCLUIDA_COM_PENDENCIAS' : 'CONCLUIDA',
      totalLinhasGravadas: snapshotsGravados,
      totalPendencias: pendenciasGravadas,
      concluidaEm: new Date(),
    },
  })

  return {
    importacaoId: importacao.id,
    jaImportado: false,
    dryRun,
    processosNovos,
    processosAtualizados,
    snapshotsGravados,
    parcelasInseridas,
    parcelasAtualizadas,
    pendenciasGravadas,
  }
}

/** Cria as carteiras que ainda não existem e devolve nome -> id. */
async function garantirClientes(
  tx: Tx,
  registros: RegistroConsolidado[]
): Promise<Map<string, string>> {
  const nomes = new Set<string>()
  for (const r of registros) if (r.carteira) nomes.add(r.carteira)

  const mapa = new Map<string, string>()
  for (const nome of nomes) {
    const c = await tx.cliente.upsert({
      where: { nome },
      create: { nome },
      update: {},
      select: { id: true },
    })
    mapa.set(nome, c.id)
  }
  return mapa
}

async function gravarPendencias(
  tx: Tx,
  importacaoId: string,
  entrada: EntradaGravacao
): Promise<number> {
  const linhas: Prisma.LogValidacaoCreateManyInput[] = []

  const tipoValido = (t: string) =>
    [
      'COLUNA_NAO_RECONHECIDA', 'GERAL_DIVERGENTE', 'NUMERO_PROCESSO_REPETIDO',
      'CONFLITO_BAIXADOS_ATIVA', 'AREA_DIVERGE_TIPO_ACAO', 'MGA_DESCONHECIDO',
      'ACORDO_ORFAO', 'ABA_NAO_RECONHECIDA', 'VALOR_NAO_PARSEAVEL',
      'DATA_NAO_PARSEAVEL',
    ].includes(t)

  const adicionar = (p: Pendencia) => {
    linhas.push({
      importacaoId,
      tipo: (tipoValido(p.tipo) ? p.tipo : 'VALOR_NAO_PARSEAVEL') as never,
      severidade: 'AVISO',
      aba: p.aba,
      linha: p.linha ?? null,
      campo: p.campo ?? null,
      detalhe: p.detalhe,
    })
  }

  for (const p of entrada.pendencias) adicionar(p)
  for (const r of entrada.registros) for (const p of r.pendencias) adicionar(p)

  for (const item of entrada.reconciliacao) {
    // O padrão IDPJ é legítimo e confirmado com o Jurídico: registra como
    // informação, não como algo a corrigir.
    linhas.push({
      importacaoId,
      tipo: 'NUMERO_PROCESSO_REPETIDO',
      severidade: item.explicadoPorIdpj ? 'INFO' : 'AVISO',
      aba: item.ocorrencias[0]?.aba ?? null,
      linha: item.ocorrencias[0]?.linha ?? null,
      campo: 'numero_processo',
      detalhe:
        `Número de processo repetido em ${item.ocorrencias.length} fichas` +
        (item.explicadoPorIdpj
          ? ' — explicado por IDPJ vinculado ao processo principal (legítimo).'
          : ' — verificar se é multi-parte legítimo ou cadastro duplicado.'),
    })
  }

  for (const o of entrada.orfaos) {
    linhas.push({
      importacaoId,
      tipo: 'ACORDO_ORFAO',
      severidade: 'AVISO',
      aba: o.origem.aba,
      linha: o.origem.linha,
      campo: 'ficha',
      detalhe:
        `Acordo com parcelas cujo processo não consta no Relatório Geral do ` +
        `mesmo mês (ficha ${o.ficha ?? 'não informada'}). A importação seguiu; ` +
        'confirmar a causa com o escritório externo.',
    })
  }

  if (linhas.length) await tx.logValidacao.createMany({ data: linhas })
  return linhas.length
}

/** Converte os campos lógicos nas colunas do snapshot. */
function mapearCampos(reg: RegistroConsolidado) {
  const c = reg.campos
  const exito = c.exito_processo as { bruto?: string; numerico?: number | null } | null

  return {
    tipoAcao: str(c.tipo_acao),
    materia: str(c.materia),
    area: str(c.area),
    fase: str(c.fase),
    produto: str(c.produto),
    autor: str(c.autor),
    reu: str(c.reu),
    todosEnvolvidos: str(c.todos_envolvidos),
    comarca: str(c.comarca),
    uf: str(c.uf),
    dataCadastro: data(c.data_cadastro),
    dataAjuizamento: data(c.data_ajuizamento),
    dataCitacao: data(c.data_citacao),
    dataEncerramento: data(c.data_encerramento),
    tipoEncerramento: str(c.tipo_encerramento),
    risco: (c.risco as never) ?? null,
    valorProvisionado: num(c.valor_provisionado),
    justificativaProvisionamento: str(c.justificativa_provisionamento),
    valorCausa: num(c.valor_causa),
    valorAcordo: num(c.valor_acordo),
    valorCondenacao: num(c.valor_condenacao),
    termosAcordo: str(c.termos_acordo),
    dataCondenacao: data(c.data_condenacao),
    exitoProcessoBruto: exito?.bruto ?? null,
    exitoProcessoNumerico: exito?.numerico ?? null,
    justificativaExito: str(c.justificativa_exito),
    resultadoSentenca: str(c.resultado_sentenca),
    observacaoResultado: str(c.observacao_resultado),
    mgaNoPoloPassivo: typeof c.mga_polo_passivo === 'boolean' ? c.mga_polo_passivo : null,
    placaVeiculo: str(c.placa_veiculo),
    numeroApolice: str(c.numero_apolice),
    numeroSinistro: str(c.numero_sinistro),
    motivoSinistro: str(c.motivo_sinistro),
    dataSinistro: data(c.data_sinistro),
    oficina: str(c.oficina),
    statusBruto: str(c.status),
    situacaoAtual: str(c.situacao_atual),
    proximosPassos: str(c.proximos_passos),
    descricaoSumaria: str(c.descricao_sumaria),
  }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)
const data = (v: unknown): Date | null => (v instanceof Date ? v : null)

/**
 * Contagens do preview sem gravar nada.
 *
 * Não reexecuta a transação: só conta o que já está no banco versus o que
 * chegou. É o que o usuário precisa ver antes de aprovar a importação.
 */
async function simular(
  prisma: PrismaClient,
  entrada: EntradaGravacao
): Promise<ResultadoGravacao> {
  const chaves = entrada.registros.map(r => r.chaveIdentidade)
  const existentes = await prisma.processo.findMany({
    where: { chaveIdentidade: { in: chaves } },
    select: { id: true, chaveIdentidade: true },
  })
  const idPorChave = new Map(existentes.map(p => [p.chaveIdentidade, p.id]))

  let parcelasInseridas = 0
  let parcelasAtualizadas = 0

  for (const reg of entrada.registros) {
    const processoId = idPorChave.get(reg.chaveIdentidade)
    if (!processoId) {
      parcelasInseridas += reg.parcelas.length
      continue
    }
    const jaGravadas = await prisma.parcelaAcordo.findMany({
      where: { processoId, mesReferencia: { in: reg.parcelas.map(p => p.mesReferencia) } },
      select: { mesReferencia: true },
    })
    const set = new Set(jaGravadas.map(p => p.mesReferencia))
    for (const p of reg.parcelas) {
      if (set.has(p.mesReferencia)) parcelasAtualizadas++
      else parcelasInseridas++
    }
  }

  const pendencias =
    entrada.pendencias.length +
    entrada.registros.reduce((s, r) => s + r.pendencias.length, 0) +
    entrada.reconciliacao.length +
    entrada.orfaos.length

  return {
    importacaoId: null,
    jaImportado: false,
    dryRun: true,
    processosNovos: entrada.registros.length - existentes.length,
    processosAtualizados: existentes.length,
    snapshotsGravados: entrada.registros.length,
    parcelasInseridas,
    parcelasAtualizadas,
    pendenciasGravadas: pendencias,
  }
}
