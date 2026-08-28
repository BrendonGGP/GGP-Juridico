'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { brl, inteiro } from './Numero'

/**
 * Gráficos do painel.
 *
 * Três decisões que valem para todos:
 *
 *  - Todo gráfico tem uma tabela equivalente ao lado ou abaixo. Gráfico é
 *    resumo visual; o número exato vive na tabela, que também é o que um
 *    leitor de tela e uma impressão em preto e branco alcançam.
 *  - As cores saem da paleta da marca. Onde uma série precisa se distinguir
 *    de outra, a diferença nunca é só de matiz — há rótulo no eixo.
 *  - Sem animação de entrada: `isAnimationActive={false}`. O painel é lido em
 *    reunião, e barra crescendo atrasa a leitura do número.
 */

const COR_PRIMARIA = '#00819c'
const COR_ACENTO = '#65e7de'
const COR_EIXO = '#595959'
const COR_GRADE = '#e3e8ea'

const eixoY = {
  tick: { fill: COR_EIXO, fontSize: 12 },
  axisLine: false,
  tickLine: false,
} as const

const eixoX = {
  tick: { fill: COR_EIXO, fontSize: 12 },
  axisLine: { stroke: COR_GRADE },
  tickLine: false,
} as const

/** Abrevia para o eixo: 1.200.000 -> "1,2 mi". Tooltip mostra o valor cheio. */
function abreviar(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)} mil`
  return String(v)
}

/**
 * O formatter do Recharts pode receber `undefined` ou string.
 *
 * Não é um detalhe de tipagem a ser silenciado com cast: um valor ausente
 * formatado como número viraria "R$ NaN" no tooltip. Aqui a ausência é
 * declarada como tal.
 */
function comoNumero(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

const estiloTooltip = {
  contentStyle: {
    borderRadius: 8,
    border: '1px solid #c9d2d6',
    fontSize: 13,
    boxShadow: '0 4px 12px rgb(26 26 26 / 0.08)',
  },
  labelStyle: { color: '#1a1a1a', fontWeight: 600 },
} as const

/** Rótulo do mês "2026-07" -> "jul/26". */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const nome = nomes[Number(m) - 1]
  return nome ? `${nome}/${ano.slice(2)}` : mes
}

/**
 * Provisionamento por faixa de risco, no cenário selecionado.
 *
 * Cada barra recebe a cor da própria pílula de risco, para o gráfico e a
 * tabela falarem a mesma língua visual.
 */
export function GraficoRisco({
  dados,
}: {
  dados: { risco: string; rotulo: string; valor: number; casos: number }[]
}) {
  const CORES: Record<string, string> = {
    PROVAVEL: '#b3564a',
    POSSIVEL: '#c08a2e',
    REMOTO: '#4d8a66',
  }

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={COR_GRADE} vertical={false} />
          <XAxis dataKey="rotulo" {...eixoX} />
          <YAxis tickFormatter={abreviar} {...eixoY} width={64} />
          <Tooltip
            {...estiloTooltip}
            formatter={v => {
              const n = comoNumero(v)
              return [n === null ? 'sem valor' : brl(n), 'Provisionado']
            }}
            cursor={{ fill: 'rgb(0 129 156 / 0.06)' }}
          />
          <Bar dataKey="valor" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {dados.map(d => (
              <Cell key={d.risco} fill={CORES[d.risco] ?? COR_PRIMARIA} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Desembolso mês a mês.
 *
 * Os meses fora da cobertura real dos dados aparecem em tom de acento, não
 * na cor cheia — para não parecer que um mês sem parcela conhecida vale zero.
 */
export function GraficoDesembolso({
  serie,
  ultimoMesComDados,
}: {
  serie: { mesReferencia: string; valor: number; casos: number }[]
  ultimoMesComDados: string | null
}) {
  const dados = serie.map(m => ({
    ...m,
    rotulo: rotuloMes(m.mesReferencia),
    dentroDaCobertura:
      ultimoMesComDados === null ? false : m.mesReferencia <= ultimoMesComDados,
  }))

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={COR_GRADE} vertical={false} />
          <XAxis dataKey="rotulo" {...eixoX} interval="preserveStartEnd" />
          <YAxis tickFormatter={abreviar} {...eixoY} width={64} />
          <Tooltip
            {...estiloTooltip}
            formatter={(v, _n, item) => {
              const n = comoNumero(v)
              const casos = (item?.payload as { casos?: number } | undefined)?.casos ?? 0
              return [n === null ? 'sem valor' : brl(n), `${casos} parcela(s)`]
            }}
            cursor={{ fill: 'rgb(0 129 156 / 0.06)' }}
          />
          <Bar dataKey="valor" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {dados.map(d => (
              <Cell
                key={d.mesReferencia}
                fill={d.dentroDaCobertura ? COR_PRIMARIA : COR_ACENTO}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Barras horizontais para rankings com rótulo longo (Tipo de Ação, M.G.A). */
export function GraficoRanking({
  itens,
}: {
  itens: { rotulo: string; quantidade: number }[]
}) {
  const altura = Math.max(160, itens.length * 34 + 24)
  return (
    <div style={{ width: '100%', height: altura }}>
      <ResponsiveContainer>
        <BarChart
          data={itens}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid stroke={COR_GRADE} horizontal={false} />
          <XAxis type="number" {...eixoX} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="rotulo"
            {...eixoY}
            width={180}
            tickFormatter={(r: string) => (r.length > 26 ? `${r.slice(0, 25)}…` : r)}
          />
          <Tooltip
            {...estiloTooltip}
            formatter={v => {
              const n = comoNumero(v)
              return [n === null ? 'sem dado' : `${inteiro(n)} processo(s)`, '']
            }}
            cursor={{ fill: 'rgb(0 129 156 / 0.06)' }}
          />
          <Bar
            dataKey="quantidade"
            fill={COR_PRIMARIA}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
