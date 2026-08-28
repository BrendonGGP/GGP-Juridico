/**
 * Roda o motor de cálculo contra as planilhas REAIS.
 *
 * Teste unitário prova que a fórmula faz o que eu pedi. Este script mostra o
 * que ela produz sobre os dados que existem — inclusive quantos processos
 * ficam de fora e por quê, que é a parte fácil de esconder num total bonito.
 *
 * Usa exatamente o mesmo pipeline e o mesmo motor da aplicação
 * (`lib/ingestao/pipeline.ts` + `lib/painel/montar.ts`). Um script de
 * conferência que refaz a lógica por conta própria confere a si mesmo.
 *
 * PRIVACIDADE: agregados e contagens apenas. Nenhum processo é identificado.
 *
 * Uso: node --experimental-strip-types scripts/testar-calculos.ts [AAAA-MM]
 */
import { carregar } from './_selecionar-arquivos.ts'
import { processarPlanilhas } from '../lib/ingestao/pipeline.ts'
import { montarPainel } from '../lib/painel/montar.ts'
import { parcelasDePlanilha, processosDePlanilha } from '../lib/painel/de-planilha.ts'
import { CENARIOS, ROTULO_CENARIO } from '../lib/calculo/cenarios.ts'
import { brl, inteiro } from '../lib/formato.ts'

const MES = process.argv[2] ?? '2026-07'

// Seleção explícita: ambiguidade entre versões vira erro, não escolha silenciosa.
const fGeral = carregar('GERAL', MES)
const fAcordos = carregar('ACORDOS', MES)
console.log('ARQUIVOS USADOS')
console.log(`  Geral:   ${fGeral.arquivo.nome}`)
console.log(`  Acordos: ${fAcordos.arquivo.nome}`)

const pipeline = processarPlanilhas(fGeral.conteudo, fAcordos.conteudo)
const { registros, orfaos } = pipeline

const painel = montarPainel(
  processosDePlanilha(registros),
  {
    id: 'conferencia',
    mesReferencia: MES,
    concluidaEm: new Date(),
    arquivoGeralNome: fGeral.arquivo.nome,
    totalPendencias: pipeline.pendencias.length,
  },
  parcelasDePlanilha(registros)
)

if (pipeline.pendencias.length) {
  console.log(`\nPENDÊNCIAS: ${pipeline.pendencias.length}`)
  for (const p of pipeline.pendencias.slice(0, 8)) {
    console.log(`  [${p.tipo}] ${p.detalhe.slice(0, 130)}`)
  }
}

console.log(`\nACORDOS: ${pipeline.totais.registrosAcordo} registros, ${orfaos.length} órfão(s)`)
for (const o of orfaos) console.log(`  órfão: ficha ${o.ficha ?? '(sem)'} — linha ${o.origem.linha}`)

console.log('='.repeat(70))
console.log(`BASE: ${inteiro(painel.totalProcessos)} processos (${MES})`)
console.log('='.repeat(70))

// --- Cenários --------------------------------------------------------------
console.log('\nPROVISIONAMENTO POR CENÁRIO')
for (const c of CENARIOS) {
  console.log(
    `  ${ROTULO_CENARIO[c].padEnd(13)} ${brl(painel.cenarios[c].totalProvisionado).padStart(18)}`
  )
}

const realista = painel.cenarios.REALISTA
console.log('\n  Detalhe do cenário Realista:')
for (const g of realista.grupos) {
  console.log(
    `    ${g.risco.padEnd(9)} ${String(g.casos).padStart(4)} casos  ` +
      `bruto ${brl(g.valorBruto).padStart(16)}  ` +
      `× ${(g.percentualAplicado * 100).toFixed(0).padStart(3)}%  = ${brl(g.valorProvisionado).padStart(16)}`
  )
}

console.log('\n  EXCLUÍDOS do provisionamento (não somados como zero):')
console.log(`    encerrados: ${realista.excluidos.encerrados}`)
console.log(`    sem risco:  ${realista.excluidos.semRisco}`)
console.log(`    sem valor:  ${realista.excluidos.semValor}`)
console.log(`    total considerado: ${realista.totalCasos} de ${painel.totalProcessos}`)

// --- Projeção --------------------------------------------------------------
console.log(`\nPROJEÇÃO DE DESEMBOLSO (a partir de ${MES})`)
for (const h of [6, 12, 24] as const) {
  const x = painel.projecao.horizontes[h]
  console.log(
    `  ${String(h).padStart(2)} meses: ${brl(x.total).padStart(16)}  ` +
      `${x.mesesComDados} meses com dado` +
      (x.incompleto ? `  [INCOMPLETO — dados vão até ${painel.projecao.ultimoMesComDados}]` : '')
  )
}

// --- Top -------------------------------------------------------------------
const { top } = painel
console.log('\nTOP DE PROCESSOS (duas listas independentes)')
console.log(`  Top por valor:        ${top.topPorValor.length} de ${top.elegiveisAoTop} elegíveis`)
console.log(`  Trabalhista + IDPJ:   ${top.trabalhistaEIdpj.length} (sem limite)`)
const idsNoTop = new Set(top.topPorValor.map(p => p.id))
console.log(`  aparecem nas duas:    ${top.trabalhistaEIdpj.filter(p => idsNoTop.has(p.id)).length}`)
if (top.topPorValor.length) {
  console.log(
    `  maior valor no Top:   ${brl(top.topPorValor[0].valorRanqueamento)} ` +
      `(origem: ${top.topPorValor[0].origemValor})`
  )
}

// --- Indicadores -----------------------------------------------------------
console.log('\nINDICADORES')

const { exito, tempo, recorrencia, teses, mga } = painel
console.log(
  `  Taxa de Êxito:        ${exito.percentual.valor?.toFixed(1) ?? exito.percentual.indisponivel}%` +
    `  (base ${exito.percentual.base} processos com sentença)`
)
console.log(`    pedido ${brl(exito.valorPedido)} -> devido ${brl(exito.valorDevido)}`)

console.log(
  `  Tempo médio:          ${tempo.dias.valor?.toFixed(0) ?? '—'} dias ` +
    `(mediana ${tempo.medianaDias ?? '—'}, base ${tempo.dias.base})`
)

console.log(`  Recorrência por Tipo de Ação (de ${recorrencia.total} classificados):`)
for (const i of recorrencia.itens.slice(0, 5)) {
  console.log(
    `    ${String(i.quantidade).padStart(4)}x  ${i.percentual.toFixed(1).padStart(5)}%  ${i.rotulo}`
  )
}

console.log(`  Efeito de teses: ${teses.length} motivos com base suficiente`)
for (const t of teses.slice(0, 5)) {
  console.log(
    `    ${String(t.total).padStart(3)} casos  ganho ${String(t.ganhos).padStart(3)} / ` +
      `perda ${String(t.perdas).padStart(3)} / parcial ${String(t.parciais).padStart(3)}  ` +
      `taxa ${t.taxaGanho.valor?.toFixed(0) ?? '—'}%  ${t.motivo.slice(0, 40)}`
  )
}

console.log(`  Concentração por M.G.A (${mga.semMga} processos sem M.G.A):`)
for (const i of mga.itens.slice(0, 5)) {
  console.log(`    ${String(i.quantidade).padStart(4)}x  ${i.rotulo.slice(0, 40)}`)
}
