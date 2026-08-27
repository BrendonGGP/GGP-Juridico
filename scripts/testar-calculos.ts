/**
 * Roda o motor de cálculo contra as planilhas REAIS.
 *
 * Teste unitário prova que a fórmula faz o que eu pedi. Este script mostra o
 * que ela produz sobre os dados que existem — inclusive quantos processos
 * ficam de fora e por quê, que é a parte fácil de esconder num total bonito.
 *
 * PRIVACIDADE: agregados e contagens apenas. Nenhum processo é identificado.
 *
 * Uso: node --experimental-strip-types scripts/testar-calculos.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { lerPlanilha } from '../lib/ingestao/ler-planilha.ts'
import { consolidar, mesclarAcordos } from '../lib/ingestao/consolidar.ts'
import { calcularTodosCenarios, CENARIOS, ROTULO_CENARIO } from '../lib/calculo/cenarios.ts'
import { calcularProjecao } from '../lib/calculo/projecao.ts'
import { calcularTop } from '../lib/calculo/top-processos.ts'
import {
  calcularTaxaExito,
  calcularTempoMedio,
  calcularRecorrencia,
  calcularEfeitoTeses,
  calcularConcentracaoMga,
} from '../lib/calculo/kpis.ts'

const DIR = path.join(process.cwd(), 'dados-reais')
const arquivos = fs.readdirSync(DIR).filter(f => f.endsWith('.xlsx'))
const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const lidoGeral = lerPlanilha(fs.readFileSync(path.join(DIR, arquivos.find(f => f.includes('JULHO'))!)))
const consGeral = consolidar(lidoGeral.linhas)
const lidoAcordos = lerPlanilha(
  fs.readFileSync(path.join(DIR, arquivos.find(f => f.toUpperCase().includes('ACORDOS'))!))
)
const { registros } = mesclarAcordos(consGeral.registros, consolidar(lidoAcordos.linhas).registros)

const n = (v: unknown) => (typeof v === 'number' ? v : null)
const s = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null)
const dt = (v: unknown) => (v instanceof Date ? v : null)

// ---------------------------------------------------------------------------
console.log('='.repeat(70))
console.log(`BASE: ${registros.length} processos (julho/2026)`)
console.log('='.repeat(70))

// --- Cenários --------------------------------------------------------------
const paraProvisionar = registros.map(r => ({
  risco: (r.campos.risco as 'PROVAVEL' | 'POSSIVEL' | 'REMOTO' | null) ?? null,
  valorProvisionado: n(r.campos.valor_provisionado),
  encerrado: r.encerrado,
}))
const cen = calcularTodosCenarios(paraProvisionar)

console.log('\nPROVISIONAMENTO POR CENÁRIO')
for (const c of CENARIOS) {
  console.log(`  ${ROTULO_CENARIO[c].padEnd(13)} ${brl(cen[c].totalProvisionado).padStart(18)}`)
}
console.log('\n  Detalhe do cenário Realista:')
for (const g of cen.REALISTA.grupos) {
  console.log(
    `    ${g.risco.padEnd(9)} ${String(g.casos).padStart(4)} casos  ` +
      `bruto ${brl(g.valorBruto).padStart(16)}  ` +
      `× ${(g.percentualAplicado * 100).toFixed(0).padStart(3)}%  = ${brl(g.valorProvisionado).padStart(16)}`
  )
}
console.log('\n  EXCLUÍDOS do provisionamento (não somados como zero):')
console.log(`    encerrados: ${cen.REALISTA.excluidos.encerrados}`)
console.log(`    sem risco:  ${cen.REALISTA.excluidos.semRisco}`)
console.log(`    sem valor:  ${cen.REALISTA.excluidos.semValor}`)
console.log(`    total considerado: ${cen.REALISTA.totalCasos} de ${registros.length}`)

// --- Projeção --------------------------------------------------------------
const parcelas = registros.flatMap(r =>
  r.parcelas.map(p => ({ mesReferencia: p.mesReferencia, valor: p.valor }))
)
const proj = calcularProjecao(parcelas, '2026-07')
console.log('\nPROJEÇÃO DE DESEMBOLSO (a partir de 2026-07)')
for (const h of [6, 12, 24] as const) {
  const x = proj.horizontes[h]
  console.log(
    `  ${String(h).padStart(2)} meses: ${brl(x.total).padStart(16)}  ` +
      `${x.mesesComDados} meses com dado${x.incompleto ? '  [INCOMPLETO — dados vão até ' + proj.ultimoMesComDados + ']' : ''}`
  )
}

// --- Top -------------------------------------------------------------------
const top = calcularTop(
  registros.map((r, i) => ({
    id: String(i),
    numeroProcesso: s(r.numeroProcesso),
    carteira: r.carteira,
    area: s(r.campos.area),
    tipoAcao: s(r.campos.tipo_acao),
    risco: (r.campos.risco as 'PROVAVEL' | 'POSSIVEL' | 'REMOTO' | null) ?? null,
    encerrado: r.encerrado,
    valorCausa: n(r.campos.valor_causa),
    valorAcordo: n(r.campos.valor_acordo),
    valorCondenacao: n(r.campos.valor_condenacao),
    valorProvisionado: n(r.campos.valor_provisionado),
  }))
)
console.log('\nTOP DE PROCESSOS (duas listas independentes)')
console.log(`  Top por valor:        ${top.topPorValor.length} de ${top.elegiveisAoTop} elegíveis`)
console.log(`  Trabalhista + IDPJ:   ${top.trabalhistaEIdpj.length} (sem limite)`)
const nasDuas = top.topPorValor.filter(p => top.trabalhistaEIdpj.some(t => t.id === p.id)).length
console.log(`  aparecem nas duas:    ${nasDuas}`)
if (top.topPorValor.length) {
  console.log(
    `  maior valor no Top:   ${brl(top.topPorValor[0].valorRanqueamento)} (origem: ${top.topPorValor[0].origemValor})`
  )
}

// --- KPIs ------------------------------------------------------------------
console.log('\nINDICADORES')

const exito = calcularTaxaExito(
  registros.map(r => ({
    valorCausa: n(r.campos.valor_causa),
    valorAcordo: n(r.campos.valor_acordo),
    valorCondenacao: n(r.campos.valor_condenacao),
    encerrado: r.encerrado,
    resultadoSentenca: s(r.campos.resultado_sentenca),
  }))
)
console.log(
  `  Taxa de Êxito:        ${exito.percentual.valor?.toFixed(1) ?? exito.percentual.indisponivel}%` +
    `  (base ${exito.percentual.base} processos com sentença)`
)
console.log(`    pedido ${brl(exito.valorPedido)} -> devido ${brl(exito.valorDevido)}`)

const tempo = calcularTempoMedio(
  registros.map(r => ({
    dataCadastro: dt(r.campos.data_cadastro),
    dataEncerramento: dt(r.campos.data_encerramento),
  }))
)
console.log(
  `  Tempo médio:          ${tempo.dias.valor?.toFixed(0) ?? '—'} dias ` +
    `(mediana ${tempo.medianaDias ?? '—'}, base ${tempo.dias.base})`
)

const rec = calcularRecorrencia(registros.map(r => s(r.campos.tipo_acao)), 5)
console.log(`  Recorrência por Tipo de Ação (top 5, de ${rec.total} classificados):`)
for (const i of rec.itens) {
  console.log(`    ${String(i.quantidade).padStart(4)}x  ${i.percentual.toFixed(1).padStart(5)}%  ${i.rotulo}`)
}

const teses = calcularEfeitoTeses(
  registros.map(r => ({
    motivoSinistro: s(r.campos.motivo_sinistro),
    resultadoSentenca: s(r.campos.resultado_sentenca),
    poloCliente: s(r.campos.polo_cliente),
  }))
)
console.log(`  Efeito de teses: ${teses.length} motivos com base suficiente`)
for (const t of teses.slice(0, 5)) {
  console.log(
    `    ${String(t.total).padStart(3)} casos  ganho ${String(t.ganhos).padStart(3)} / ` +
      `perda ${String(t.perdas).padStart(3)} / parcial ${String(t.parciais).padStart(3)}  ` +
      `taxa ${t.taxaGanho.valor?.toFixed(0) ?? '—'}%  ${t.motivo.slice(0, 40)}`
  )
}

const mga = calcularConcentracaoMga(registros.map(r => s(r.campos.mga)), 5)
console.log(`  Concentração por M.G.A (top 5; ${mga.semMga} processos sem M.G.A):`)
for (const i of mga.itens) {
  console.log(`    ${String(i.quantidade).padStart(4)}x  ${i.rotulo.slice(0, 40)}`)
}
