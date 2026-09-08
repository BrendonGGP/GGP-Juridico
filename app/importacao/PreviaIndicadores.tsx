'use client'

import { useState } from 'react'
import { Cartao } from '@/components/shell/Pagina'
import { CartaoValor, CartaoIndicador } from '@/components/dados/Numero'
import { SeletorCenario, ExplicacaoCenario } from '@/components/dados/SeletorCenario'
import { GraficoRisco, GraficoDesembolso, GraficoRanking, rotuloMes } from '@/components/dados/Graficos'
import { Tabela, Linha, Celula } from '@/components/dados/Tabela'
import { PilulaRisco } from '@/components/dados/PilulaRisco'
import { IconeAtencao } from '@/components/icones'
import { ROTULO_CENARIO, CENARIOS, type Cenario, type Risco } from '@/lib/calculo/cenarios'
import { brl, inteiro } from '@/lib/formato'

/**
 * Prévia dos indicadores, calculada sobre a planilha enviada.
 *
 * Os números vêm do MESMO motor que alimenta o painel depois de gravar — a
 * API roda `planilha -> montarPainel`, o mesmo caminho de `de-banco.ts`. É o
 * que torna a prévia útil para decidir: o que aparece aqui é o que aparecerá
 * lá.
 *
 * O que NÃO aparece: as duas listas do Top processo a processo. A API manda
 * só as contagens. Nesta tela a análise ainda não foi aprovada por ninguém, e
 * exibir número de processo e valor individual antes disso é dado demais para
 * uma conferência. As listas completas ficam no Relatório Executivo, depois
 * de gravar.
 *
 * NADA foi gravado até aqui.
 */

export interface IndicadoresPrevia {
  cenarios: Record<
    Cenario,
    {
      totalProvisionado: number
      totalCasos: number
      grupos: {
        risco: Risco
        casos: number
        valorBruto: number
        percentualAplicado: number
        valorProvisionado: number
      }[]
      excluidos: { encerrados: number; semRisco: number; semValor: number }
    }
  >
  projecao: {
    horizontes: Record<6 | 12 | 24, { total: number; mesesComDados: number; incompleto: boolean }>
    ultimoMesComDados: string | null
    totalGeral: number
    serie: { mesReferencia: string; valor: number; casos: number }[]
  }
  exito: {
    percentual: { valor: number | null; indisponivel?: string; base: number }
    valorPedido: number
    valorDevido: number
    valorEconomizado: number
    processosComSentenca: number
  }
  tempo: {
    dias: { valor: number | null; indisponivel?: string; base: number }
    medianaDias: number | null
  }
  recorrencia: { itens: { rotulo: string; quantidade: number; percentual: number }[]; total: number; semClassificacao: number }
  mga: { itens: { rotulo: string; quantidade: number; percentual: number }[]; semMga: number }
  top: { quantidadePorValor: number; elegiveisAoTop: number; quantidadeTrabalhistaIdpj: number }
}

const ROTULO_RISCO: Record<Risco, string> = {
  PROVAVEL: 'Provável',
  POSSIVEL: 'Possível',
  REMOTO: 'Remoto',
}

export function PreviaIndicadores({
  indicadores,
  totalProcessos,
}: {
  indicadores: IndicadoresPrevia
  totalProcessos: number
}) {
  const [cenario, setCenario] = useState<Cenario>('REALISTA')
  const atual = indicadores.cenarios[cenario]
  const fora = totalProcessos - atual.totalCasos

  const dadosRisco = atual.grupos.map(g => ({
    risco: g.risco,
    rotulo: ROTULO_RISCO[g.risco],
    valor: g.valorProvisionado,
    casos: g.casos,
  }))

  return (
    <section className="mt-10 space-y-6" aria-labelledby="titulo-previa">
      <div>
        <h2 id="titulo-previa" className="text-xl font-semibold tracking-tight">
          Como ficarão os indicadores
        </h2>
        <p className="mt-1 text-sm text-texto-suave">
          Calculado sobre a planilha enviada, com o mesmo motor do painel. Nada
          foi gravado — estes números aparecem no sistema só depois que você
          confirmar.
        </p>
      </div>

      {/* --- Visão Executiva: os três cenários lado a lado ------------- */}
      <Cartao
        titulo="Visão Executiva"
        descricao="Os três cenários sobre a mesma carteira. O intervalo é a informação."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {CENARIOS.map(c => (
            <CartaoValor
              key={c}
              rotulo={ROTULO_CENARIO[c]}
              valor={brl(indicadores.cenarios[c].totalProvisionado)}
              destaque={c === 'REALISTA'}
              nota={`${inteiro(indicadores.cenarios[c].totalCasos)} processos considerados`}
            />
          ))}
        </div>

        <div className="mt-4 grid gap-4 border-t border-borda pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <CartaoValor
            rotulo="Desembolso — 12 meses"
            valor={brl(indicadores.projecao.horizontes[12].total)}
            nota={
              indicadores.projecao.horizontes[12].incompleto
                ? `dados até ${indicadores.projecao.ultimoMesComDados ? rotuloMes(indicadores.projecao.ultimoMesComDados) : '—'}`
                : `${indicadores.projecao.horizontes[12].mesesComDados} meses com parcela`
            }
          />
          <CartaoIndicador
            rotulo="Taxa de êxito"
            indicador={indicadores.exito.percentual}
            formatar={n => n.toFixed(1)}
            sufixo="%"
            descricaoBase={b => `${inteiro(b)} processos com sentença`}
          />
          <CartaoIndicador
            rotulo="Tempo médio"
            indicador={indicadores.tempo.dias}
            formatar={n => inteiro(Math.round(n))}
            sufixo=" dias"
            descricaoBase={b => `mediana ${indicadores.tempo.medianaDias ?? '—'} · base ${inteiro(b)}`}
          />
          <CartaoValor
            rotulo="Trabalhista e IDPJ"
            valor={inteiro(indicadores.top.quantidadeTrabalhistaIdpj)}
            nota="acompanhamento sem limite"
          />
        </div>
      </Cartao>

      {/* --- Dashboard: decomposição por risco ------------------------- */}
      <Cartao
        titulo="Dashboard"
        descricao="Como o passivo se decompõe no cenário escolhido."
        acoes={<SeletorCenario valor={cenario} onChange={setCenario} />}
      >
        <div className="mb-4">
          <ExplicacaoCenario cenario={cenario} />
        </div>

        <GraficoRisco dados={dadosRisco} />

        <div className="mt-5">
          <Tabela
            legenda={`Valores por faixa de risco no cenário ${ROTULO_CENARIO[cenario]}`}
            larguraMinima="34rem"
            cabecalho={[
              { rotulo: 'Risco' },
              { rotulo: 'Processos', numerico: true },
              { rotulo: 'Valor bruto', numerico: true },
              { rotulo: '% aplicado', numerico: true },
              { rotulo: 'Provisionado', numerico: true },
            ]}
          >
            {atual.grupos.map(g => (
              <Linha key={g.risco}>
                <Celula>
                  <PilulaRisco risco={g.risco} />
                </Celula>
                <Celula numerico>{inteiro(g.casos)}</Celula>
                <Celula numerico>{brl(g.valorBruto)}</Celula>
                <Celula numerico>{(g.percentualAplicado * 100).toFixed(0)}%</Celula>
                <Celula numerico className="font-semibold">
                  {brl(g.valorProvisionado)}
                </Celula>
              </Linha>
            ))}
          </Tabela>
        </div>

        {fora > 0 && (
          <div className="mt-4 flex gap-3 rounded-ggp-sm bg-atencao-fundo p-3 text-sm text-atencao-texto">
            <IconeAtencao className="mt-0.5 shrink-0" />
            <p>
              {inteiro(fora)} processos ficam fora deste cenário:{' '}
              {inteiro(atual.excluidos.encerrados)} encerrados ·{' '}
              {inteiro(atual.excluidos.semRisco)} sem risco ·{' '}
              {inteiro(atual.excluidos.semValor)} sem valor. Nenhum é somado como zero.
            </p>
          </div>
        )}
      </Cartao>

      {/* --- Projeção de desembolso ------------------------------------ */}
      {indicadores.projecao.serie.length > 0 && (
        <Cartao
          titulo="Projeção de desembolso"
          descricao="Alimentada pelas parcelas de acordo da planilha."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {([6, 12, 24] as const).map(h => (
              <CartaoValor
                key={h}
                rotulo={`${h} meses`}
                valor={brl(indicadores.projecao.horizontes[h].total)}
                nota={
                  indicadores.projecao.horizontes[h].incompleto
                    ? 'incompleto — além dos dados'
                    : `${indicadores.projecao.horizontes[h].mesesComDados} meses com parcela`
                }
              />
            ))}
          </div>
          <div className="mt-5">
            <GraficoDesembolso
              serie={indicadores.projecao.serie}
              ultimoMesComDados={indicadores.projecao.ultimoMesComDados}
            />
          </div>
        </Cartao>
      )}

      {/* --- Relatório Executivo: síntese ------------------------------ */}
      <Cartao
        titulo="Relatório Executivo"
        descricao="A síntese que vai para a Diretoria."
      >
        <Tabela
          legenda="Provisionamento por cenário"
          larguraMinima="30rem"
          cabecalho={[
            { rotulo: 'Cenário' },
            { rotulo: 'Processos', numerico: true },
            { rotulo: 'Provisionado', numerico: true },
          ]}
        >
          {CENARIOS.map(c => (
            <Linha key={c}>
              <Celula className={c === 'REALISTA' ? 'font-semibold' : ''}>
                {ROTULO_CENARIO[c]}
              </Celula>
              <Celula numerico>{inteiro(indicadores.cenarios[c].totalCasos)}</Celula>
              <Celula numerico className={c === 'REALISTA' ? 'font-semibold' : ''}>
                {brl(indicadores.cenarios[c].totalProvisionado)}
              </Celula>
            </Linha>
          ))}
        </Tabela>

        <div className="mt-5 grid gap-4 border-t border-borda pt-4 sm:grid-cols-2">
          <CartaoValor
            rotulo="Top por valor"
            valor={`${inteiro(indicadores.top.quantidadePorValor)} de ${inteiro(indicadores.top.elegiveisAoTop)}`}
            nota="elegíveis acima do valor mínimo"
          />
          <CartaoValor
            rotulo="Valor economizado"
            valor={brl(indicadores.exito.valorEconomizado)}
            nota={`sobre ${brl(indicadores.exito.valorPedido)} pedidos`}
          />
        </div>

        <p className="mt-4 text-xs text-texto-suave">
          As duas listas do Top, processo a processo, ficam no Relatório
          Executivo — depois de confirmar a importação.
        </p>
      </Cartao>

      {/* --- Rankings -------------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {indicadores.recorrencia.itens.length > 0 && (
          <Cartao
            titulo="Recorrência por tipo de ação"
            descricao={`${inteiro(indicadores.recorrencia.total)} processos classificados.`}
          >
            <GraficoRanking itens={indicadores.recorrencia.itens} />
            {indicadores.recorrencia.semClassificacao > 0 && (
              <p className="mt-2 text-xs text-texto-suave">
                {inteiro(indicadores.recorrencia.semClassificacao)} sem tipo informado.
              </p>
            )}
          </Cartao>
        )}

        {indicadores.mga.itens.length > 0 && (
          <Cartao titulo="Concentração por M.G.A" descricao="Quem concentra mais demanda.">
            <GraficoRanking itens={indicadores.mga.itens} />
            {indicadores.mga.semMga > 0 && (
              <p className="mt-2 text-xs text-texto-suave">
                {inteiro(indicadores.mga.semMga)} sem M.G.A identificada.
              </p>
            )}
          </Cartao>
        )}
      </div>
    </section>
  )
}
