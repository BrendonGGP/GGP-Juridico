/**
 * Pipeline de leitura das planilhas: ler -> consolidar -> mesclar acordos.
 *
 * Estava copiado em quatro scripts de conferência. Cada cópia era uma chance
 * de alguém esquecer a mesclagem de acordos ou trocar a ordem, e produzir um
 * relatório de conferência que não reflete o que a aplicação faz.
 *
 * Não é código só de script: é a mesma sequência que a rota de importação
 * executa. Por isso vive em `lib/`, não em `scripts/`.
 */

import { lerPlanilha, type Pendencia } from './ler-planilha.ts'
import {
  consolidar,
  mesclarAcordos,
  type ItemReconciliacao,
  type RegistroConsolidado,
} from './consolidar.ts'

export interface ResultadoPipeline {
  /** Processos prontos para cálculo ou gravação, com acordos já mesclados. */
  registros: RegistroConsolidado[]
  /** Acordos que não casaram com nenhum processo do Relatório Geral. */
  orfaos: RegistroConsolidado[]
  /** Pendências de estrutura e de linha, das duas planilhas. */
  pendencias: Pendencia[]
  /** `numero_processo` repetido — precisa de olho humano. */
  reconciliacao: ItemReconciliacao[]
  /** Meses de parcela detectados nas colunas dinâmicas. */
  mesesDetectados: string[]
  totais: {
    linhasGeral: number
    registrosGeral: number
    registrosAcordo: number
  }
}

/**
 * Executa o pipeline completo.
 *
 * @param geral   Bytes do Relatório Geral. Obrigatório.
 * @param acordos Bytes da planilha de Acordos. Opcional: nem todo mês vem
 *                versão nova, e a ausência não é erro.
 */
export function processarPlanilhas(geral: Buffer, acordos?: Buffer): ResultadoPipeline {
  const lidoGeral = lerPlanilha(geral)
  const consGeral = consolidar(lidoGeral.linhas)

  if (!acordos) {
    return {
      registros: consGeral.registros,
      orfaos: [],
      pendencias: [...lidoGeral.pendencias, ...consGeral.pendencias],
      reconciliacao: consGeral.reconciliacao,
      mesesDetectados: lidoGeral.mesesDetectados,
      totais: {
        linhasGeral: lidoGeral.linhas.length,
        registrosGeral: consGeral.registros.length,
        registrosAcordo: 0,
      },
    }
  }

  const lidoAcordos = lerPlanilha(acordos)
  const consAcordos = consolidar(lidoAcordos.linhas)
  const { registros, orfaos } = mesclarAcordos(consGeral.registros, consAcordos.registros)

  return {
    registros,
    orfaos,
    pendencias: [
      ...lidoGeral.pendencias,
      ...consGeral.pendencias,
      ...lidoAcordos.pendencias,
      ...consAcordos.pendencias,
    ],
    reconciliacao: consGeral.reconciliacao,
    // Os meses vêm da planilha de acordos, que é quem traz as parcelas.
    mesesDetectados: lidoAcordos.mesesDetectados,
    totais: {
      linhasGeral: lidoGeral.linhas.length,
      registrosGeral: consGeral.registros.length,
      registrosAcordo: consAcordos.registros.length,
    },
  }
}
