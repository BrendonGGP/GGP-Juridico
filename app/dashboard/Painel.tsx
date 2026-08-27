'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Cartao } from '@/components/shell/Pagina'
import { SeletorCenario, ExplicacaoCenario } from '@/components/dados/SeletorCenario'
import { CartaoValor, CartaoIndicador, brl, inteiro } from '@/components/dados/Numero'
import { GraficoRisco, GraficoDesembolso, GraficoRanking, rotuloMes } from '@/components/dados/Graficos'
import { Tabela, Linha, Celula } from '@/components/dados/Tabela'
import { PilulaRisco } from '@/components/dados/PilulaRisco'
import { ROTULO_CENARIO, type Cenario, type Risco } from '@/lib/calculo/cenarios'
import { IconeAtencao } from '@/components/icones'

/**
 * Parte interativa do Dashboard.
 *
 * O cenário vive na URL (`?cenario=OTIMISTA`), não só em estado local: um
 * número de provisionamento é coisa que se manda por link para a Diretoria, e
 * o link precisa abrir no mesmo cenário em que foi copiado. Sem isso, duas
 * pessoas olhando "o mesmo link" veriam totais diferentes.
 *
 * O cálculo dos três cenários já vem pronto do servidor — trocar de cenário
 * não refaz requisição, só troca qual resultado é exibido.
 */

export interface DadosDashboard {
  mesReferencia: string
  totalProcessos: number
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
    serie: { mesReferencia: string; valor: number; casos: number }[]
    horizontes: Record<6 | 12 | 24, { total: number; mesesComDados: number; incompleto: boolean }>
    ultimoMesComDados: string | null
  }
  recorrencia: { itens: { rotulo: string; quantidade: number; percentual: number }[]; total: number; semClassificacao: number }
  mga: { itens: { rotulo: string; quantidade: number; percentual: number }[]; semMga: number }
  exito: { percentual: { valor: number | null; indisponivel?: string; base: number } }
  tempo: { dias: { valor: number | null; indisponivel?: string; base: number }; medianaDias: number | null }
}

const ROTULO_RISCO: Record<Risco, string> = {
  PROVAVEL: 'Provável',
  POSSIVEL: 'Possível',
  REMOTO: 'Remoto',
}

const CENARIOS_VALIDOS: Cenario[] = ['CONSERVADOR', 'REALISTA', 'OTIMISTA']

/** Cenário vindo da URL. Valor inválido cai no padrão em vez de quebrar. */
export function cenarioValido(bruto: string | null | undefined): Cenario {
  const c = bruto?.toUpperCase()
  return c && (CENARIOS_VALIDOS as string[]).includes(c) ? (c as Cenario) : 'REALISTA'
}

/**
 * Liga o cenário à URL e delega a renderização ao Painel.
 *
 * A sincronia com a URL vive aqui, e não no Painel, para que o Painel possa
 * ser renderizado fora do App Router — é o que permite verificá-lo com a base
 * real em tests/telas.test.tsx. Um componente que exige o roteador montado só
 * pode ser testado subindo meio framework junto.
 */
export function PainelComUrl({ dados }: { dados: DadosDashboard }) {
  const router = useRouter()
  const params = useSearchParams()
  const [cenario, setCenario] = useState<Cenario>(() => cenarioValido(params.get('cenario')))

  function trocar(c: Cenario) {
    setCenario(c)
    const p = new URLSearchParams(params.toString())
    p.set('cenario', c)
    // `scroll: false` — trocar cenário não deve pular a página para o topo.
    router.replace(`?${p.toString()}`, { scroll: false })
  }

  return <Painel dados={dados} cenario={cenario} onCenario={trocar} />
}

export function Painel({
  dados,
  cenario = 'REALISTA',
  onCenario,
}: {
  dados: DadosDashboard
  cenario?: Cenario
  onCenario?: (c: Cenario) => void
}) {
  const trocar = onCenario ?? (() => {})
  const atual = dados.cenarios[cenario]
  const dadosRisco = atual.grupos.map(g => ({
    risco: g.risco,
    rotulo: ROTULO_RISCO[g.risco],
    valor: g.valorProvisionado,
    casos: g.casos,
  }))

  const fora = dados.totalProcessos - atual.totalCasos

  return (
    <div className="space-y-6">
      {/* --- Controle + total ---------------------------------------- */}
      <Cartao>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm text-texto-suave">
              Passivo no cenário {ROTULO_CENARIO[cenario]}
            </div>
            <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-primaria-texto">
              {brl(atual.totalProvisionado)}
            </div>
          </div>
          <SeletorCenario valor={cenario} onChange={trocar} />
        </div>
        <div className="mt-4 border-t border-borda pt-4">
          <ExplicacaoCenario cenario={cenario} />
        </div>
      </Cartao>

      {/* --- Risco: gráfico + tabela --------------------------------- */}
      <Cartao
        titulo="Provisionamento por faixa de risco"
        descricao={`${inteiro(atual.totalCasos)} processos entram no cálculo neste cenário.`}
      >
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
              {inteiro(fora)} processos ficaram fora: {inteiro(atual.excluidos.encerrados)}{' '}
              encerrados · {inteiro(atual.excluidos.semRisco)} sem risco ·{' '}
              {inteiro(atual.excluidos.semValor)} sem valor. Nenhum somado como zero.
            </p>
          </div>
        )}
      </Cartao>

      {/* --- Desembolso ---------------------------------------------- */}
      <Cartao
        titulo="Projeção de desembolso"
        descricao="Alimentada pelas parcelas de acordo — a única fonte com data e valor por mês."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {([6, 12, 24] as const).map(h => (
            <CartaoValor
              key={h}
              rotulo={`${h} meses`}
              valor={brl(dados.projecao.horizontes[h].total)}
              nota={
                dados.projecao.horizontes[h].incompleto
                  ? `incompleto — dados até ${
                      dados.projecao.ultimoMesComDados
                        ? rotuloMes(dados.projecao.ultimoMesComDados)
                        : '—'
                    }`
                  : `${dados.projecao.horizontes[h].mesesComDados} meses com parcela`
              }
            />
          ))}
        </div>

        {dados.projecao.serie.length > 0 ? (
          <div className="mt-5">
            <GraficoDesembolso
              serie={dados.projecao.serie}
              ultimoMesComDados={dados.projecao.ultimoMesComDados}
            />
            <p className="mt-2 text-xs text-texto-suave">
              Um horizonte marcado como incompleto continua correto — apenas não
              alcança meses ainda sem parcela conhecida.
            </p>
          </div>
        ) : (
          <p className="mt-5 rounded-ggp-sm border border-dashed border-borda-forte p-4 text-center text-sm text-texto-suave">
            Nenhuma parcela de acordo registrada nesta base.
          </p>
        )}
      </Cartao>

      {/* --- Indicadores + rankings ---------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao
          titulo="Recorrência por tipo de ação"
          descricao={`${inteiro(dados.recorrencia.total)} processos classificados.`}
        >
          {dados.recorrencia.itens.length > 0 ? (
            <>
              <GraficoRanking itens={dados.recorrencia.itens} />
              {dados.recorrencia.semClassificacao > 0 && (
                <p className="mt-2 text-xs text-texto-suave">
                  {inteiro(dados.recorrencia.semClassificacao)} sem tipo de ação informado.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-texto-suave">Sem dados classificados.</p>
          )}
        </Cartao>

        <Cartao
          titulo="Concentração por M.G.A"
          descricao="Qual representante concentra mais demanda judicial."
        >
          {dados.mga.itens.length > 0 ? (
            <>
              <GraficoRanking itens={dados.mga.itens} />
              {dados.mga.semMga > 0 && (
                <p className="mt-2 text-xs text-texto-suave">
                  {inteiro(dados.mga.semMga)} processos sem M.G.A identificada.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-texto-suave">Nenhuma M.G.A identificada nesta base.</p>
          )}
        </Cartao>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CartaoIndicador
          rotulo="Taxa de êxito"
          indicador={dados.exito.percentual}
          formatar={n => n.toFixed(1)}
          sufixo="%"
          descricaoBase={b => `${inteiro(b)} processos com sentença`}
        />
        <CartaoIndicador
          rotulo="Tempo médio de tramitação"
          indicador={dados.tempo.dias}
          formatar={n => inteiro(Math.round(n))}
          sufixo=" dias"
          descricaoBase={b => `mediana ${dados.tempo.medianaDias ?? '—'} · base ${inteiro(b)}`}
        />
      </div>
    </div>
  )
}
