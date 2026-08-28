/**
 * Tipos do painel.
 *
 * Ficam num módulo próprio, sem importar Prisma nem React, para que qualquer
 * camada possa depender deles sem arrastar junto o banco ou a UI. Um teste
 * que só monta números não deveria precisar do cliente Prisma no processo.
 */

import type { calcularTodosCenarios } from '../calculo/cenarios.ts'
import type { calcularProjecao } from '../calculo/projecao.ts'
import type { calcularTop } from '../calculo/top-processos.ts'
import type {
  calcularTaxaExito,
  calcularTempoMedio,
  calcularRecorrencia,
  calcularEfeitoTeses,
  calcularConcentracaoMga,
} from '../calculo/kpis.ts'

/** Identificação da importação que originou os números exibidos. */
export interface ImportacaoVigente {
  id: string
  mesReferencia: string
  concluidaEm: Date | null
  arquivoGeralNome: string | null
  totalPendencias: number
}

/**
 * Um processo, na forma que o motor de cálculo entende.
 *
 * É a fronteira entre "de onde o dado veio" e "o que se calcula com ele".
 * O banco e a planilha são traduzidos para cá; daqui para a frente, o cálculo
 * não sabe nem precisa saber a origem.
 */
export interface ProcessoParaCalculo {
  id: string
  numeroProcesso: string | null
  carteira: string | null
  /** REGRA 7: o filtro de Trabalhista usa ESTE campo, não `tipoAcao`. */
  area: string | null
  tipoAcao: string | null
  risco: 'PROVAVEL' | 'POSSIVEL' | 'REMOTO' | null
  poloCliente: string | null
  encerrado: boolean
  valorCausa: number | null
  /** REGRA 1: nunca somado a `valorCondenacao`. O acordo substitui. */
  valorAcordo: number | null
  valorCondenacao: number | null
  valorProvisionado: number | null
  resultadoSentenca: string | null
  motivoSinistro: string | null
  mga: string | null
  dataCadastro: Date | null
  dataEncerramento: Date | null
}

/** Uma parcela de acordo, na forma que a projeção entende. */
export interface ParcelaParaCalculo {
  mesReferencia: string
  valor: number
}

/** Tudo que as telas do painel consomem. */
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
