/**
 * Apoio aos testes que rodam contra as planilhas REAIS.
 *
 * `dados-reais/` é local e gitignored: existe na máquina de quem valida,
 * nunca no CI. Por isso todo teste que depende dela precisa saber se ela
 * está presente e se declarar pulado quando não está — falhar por ausência
 * de dado transformaria o CI em ruído.
 *
 * Este módulo centraliza essa detecção e a montagem do painel a partir do
 * .xlsx, que antes estava copiada em cada arquivo de teste.
 *
 * PRIVACIDADE: nada daqui imprime conteúdo de planilha. Os testes que o usam
 * afirmam sobre agregados e estrutura.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

import { lerPlanilha } from '@/lib/ingestao/ler-planilha'
import { consolidar, mesclarAcordos } from '@/lib/ingestao/consolidar'
import { montarPainel } from '@/lib/painel/montar'
import { parcelasDePlanilha, processosDePlanilha } from '@/lib/painel/de-planilha'
import type { DadosPainel } from '@/lib/painel/tipos'

export const DIR_DADOS_REAIS = path.join(process.cwd(), 'dados-reais')

/** Mês de referência usado como base fixa dos testes de base real. */
export const MES_BASE = '2026-07'
const MARCA_MES = 'JULHO-2026'

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

/**
 * Localiza a planilha do tipo pedido, sem depender do nome exato.
 *
 * Devolve `null` quando não há exatamente um candidato — zero (pasta ausente)
 * ou mais de um (versões acumuladas). Ambiguidade nunca vira escolha
 * silenciosa: seria o mesmo erro que já produziu um recálculo com a planilha
 * errada uma vez.
 */
export function acharPlanilha(tipo: 'GERAL' | 'ACORDOS'): string | null {
  if (!fs.existsSync(DIR_DADOS_REAIS)) return null

  const candidatos = fs.readdirSync(DIR_DADOS_REAIS).filter(f => {
    if (!f.toLowerCase().endsWith('.xlsx')) return false
    const n = semAcento(f)
    const ehAcordo = n.includes('ACORDO')
    return (tipo === 'ACORDOS' ? ehAcordo : !ehAcordo) && n.includes(MARCA_MES)
  })

  return candidatos.length === 1 ? path.join(DIR_DADOS_REAIS, candidatos[0]) : null
}

const caminhoGeral = acharPlanilha('GERAL')
const caminhoAcordos = acharPlanilha('ACORDOS')

/** true quando a base real está disponível nesta máquina. */
export const temBaseReal = caminhoGeral !== null && caminhoAcordos !== null

let cache: DadosPainel | null = null

/**
 * Monta o painel a partir das planilhas reais, pelo MESMO caminho da
 * aplicação — mesmos adaptadores, mesmo motor de cálculo.
 *
 * Preguiçosa e com cache: `describe.skipIf` pula a execução dos testes, mas o
 * Vitest ainda avalia o corpo do describe para descobrir quais testes existem.
 * Ler as planilhas ali quebraria no CI, onde os caminhos são null.
 */
export function painelDaBaseReal(): DadosPainel {
  if (cache) return cache

  if (!temBaseReal) {
    throw new Error(
      'painelDaBaseReal() chamada sem dados-reais/. Envolva o teste em describe.skipIf(!temBaseReal).'
    )
  }

  const lidoGeral = lerPlanilha(fs.readFileSync(caminhoGeral!))
  const consGeral = consolidar(lidoGeral.linhas)
  const lidoAcordos = lerPlanilha(fs.readFileSync(caminhoAcordos!))
  const consAcordos = consolidar(lidoAcordos.linhas)
  const { registros } = mesclarAcordos(consGeral.registros, consAcordos.registros)

  cache = montarPainel(
    processosDePlanilha(registros),
    {
      id: 'base-real',
      mesReferencia: MES_BASE,
      concluidaEm: new Date('2026-08-05T12:00:00Z'),
      arquivoGeralNome: path.basename(caminhoGeral!),
      totalPendencias: lidoGeral.pendencias.length + consGeral.pendencias.length,
    },
    parcelasDePlanilha(registros)
  )
  return cache
}
