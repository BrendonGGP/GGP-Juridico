/**
 * Adaptador: registros consolidados de planilha -> entrada do motor de cálculo.
 *
 * Usado por scripts de conferência e testes, que precisam calcular direto do
 * .xlsx sem passar pelo banco. O par deste módulo é `de-banco.ts`.
 *
 * A responsabilidade é só traduzir. Nenhuma decisão de negócio acontece aqui:
 * qual valor vale, o que entra no Top, como o risco pesa — tudo isso vive em
 * `lib/calculo`, que é o único lugar autorizado a interpretar valor.
 */

import type { RegistroConsolidado } from '../ingestao/consolidar.ts'
import type { ParcelaParaCalculo, ProcessoParaCalculo } from './tipos.ts'

/** Só aceita número de verdade. Texto residual da planilha vira null. */
const numero = (v: unknown): number | null => (typeof v === 'number' ? v : null)

/** Só aceita texto não vazio, para "" não virar um rótulo em branco. */
const texto = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v : null

const data = (v: unknown): Date | null => (v instanceof Date ? v : null)

const risco = (v: unknown): ProcessoParaCalculo['risco'] =>
  v === 'PROVAVEL' || v === 'POSSIVEL' || v === 'REMOTO' ? v : null

export function processosDePlanilha(
  registros: RegistroConsolidado[]
): ProcessoParaCalculo[] {
  return registros.map((r, i) => ({
    // Sem banco não há id técnico; o índice serve só para desempate estável
    // dentro deste cálculo, e nunca é persistido nem exibido.
    id: String(i),
    numeroProcesso: texto(r.numeroProcesso),
    carteira: r.carteira,
    area: texto(r.campos.area),
    tipoAcao: texto(r.campos.tipo_acao),
    risco: risco(r.campos.risco),
    poloCliente: texto(r.campos.polo_cliente),
    encerrado: r.encerrado,
    valorCausa: numero(r.campos.valor_causa),
    valorAcordo: numero(r.campos.valor_acordo),
    valorCondenacao: numero(r.campos.valor_condenacao),
    valorProvisionado: numero(r.campos.valor_provisionado),
    resultadoSentenca: texto(r.campos.resultado_sentenca),
    motivoSinistro: texto(r.campos.motivo_sinistro),
    mga: texto(r.campos.mga),
    dataCadastro: data(r.campos.data_cadastro),
    dataEncerramento: data(r.campos.data_encerramento),
  }))
}

export function parcelasDePlanilha(
  registros: RegistroConsolidado[]
): ParcelaParaCalculo[] {
  return registros.flatMap(r =>
    r.parcelas.map(p => ({ mesReferencia: p.mesReferencia, valor: p.valor }))
  )
}
