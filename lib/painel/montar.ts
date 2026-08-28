/**
 * O ÚNICO lugar que roda o motor de cálculo do painel.
 *
 * Antes desta refatoração, a sequência de seis chamadas (cenários, projeção,
 * top, êxito, tempo, recorrência, teses, MGA) estava escrita três vezes: em
 * `carregar.ts` para a origem banco, em `scripts/testar-calculos.ts` e em
 * `tests/telas.test.tsx` para a origem planilha. Cada cópia mapeava os campos
 * por conta própria.
 *
 * O risco disso não é estético. Se uma cópia divergir — passar
 * `valor_provisionado` onde a outra passa `valor_causa`, por exemplo — o teste
 * continua verde validando um cálculo que a tela não faz. Num sistema que
 * projeta passivo de milhões, é a duplicação mais cara que havia.
 *
 * Agora cada origem só traduz seus registros para `ProcessoParaCalculo` e
 * chama esta função. A sequência de cálculo existe uma vez só.
 */

import { calcularTodosCenarios } from '../calculo/cenarios.ts'
import { calcularProjecao } from '../calculo/projecao.ts'
import { calcularTop } from '../calculo/top-processos.ts'
import {
  calcularTaxaExito,
  calcularTempoMedio,
  calcularRecorrencia,
  calcularEfeitoTeses,
  calcularConcentracaoMga,
} from '../calculo/kpis.ts'
import type {
  DadosPainel,
  ImportacaoVigente,
  ParcelaParaCalculo,
  ProcessoParaCalculo,
} from './tipos.ts'

/** Quantos itens os rankings de recorrência e M.G.A exibem. */
const LIMITE_RANKING = 8

export function montarPainel(
  processos: ProcessoParaCalculo[],
  importacao: ImportacaoVigente,
  parcelas: ParcelaParaCalculo[] = []
): DadosPainel {
  return {
    importacao,
    totalProcessos: processos.length,

    cenarios: calcularTodosCenarios(
      processos.map(p => ({
        risco: p.risco,
        valorProvisionado: p.valorProvisionado,
        encerrado: p.encerrado,
      }))
    ),

    // Parcela sem valor positivo não é desembolso; incluí-la só inflaria a
    // contagem de meses com dado.
    projecao: calcularProjecao(
      parcelas.filter(p => p.valor > 0),
      importacao.mesReferencia
    ),

    top: calcularTop(processos),

    exito: calcularTaxaExito(
      processos.map(p => ({
        valorCausa: p.valorCausa,
        valorAcordo: p.valorAcordo,
        valorCondenacao: p.valorCondenacao,
        encerrado: p.encerrado,
        resultadoSentenca: p.resultadoSentenca,
      }))
    ),

    tempo: calcularTempoMedio(
      processos.map(p => ({
        dataCadastro: p.dataCadastro,
        dataEncerramento: p.dataEncerramento,
      }))
    ),

    recorrencia: calcularRecorrencia(
      processos.map(p => p.tipoAcao),
      LIMITE_RANKING
    ),

    teses: calcularEfeitoTeses(
      processos.map(p => ({
        motivoSinistro: p.motivoSinistro,
        resultadoSentenca: p.resultadoSentenca,
        poloCliente: p.poloCliente,
      }))
    ),

    mga: calcularConcentracaoMga(
      processos.map(p => p.mga),
      LIMITE_RANKING
    ),
  }
}
