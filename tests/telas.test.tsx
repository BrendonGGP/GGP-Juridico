/**
 * Renderização das telas com a BASE REAL de julho/2026.
 *
 * Por que este teste existe: com o banco vazio, todas as páginas caem no
 * estado "sem dados". Um HTTP 200 nesse caso prova roteamento, não prova
 * tela — tabela, gráfico e seletor de cenário nunca chegam a renderizar.
 * Sem isto, o erro que só aparece com 836 linhas ficaria invisível até a
 * primeira importação de verdade.
 *
 * Estratégia: lê as planilhas reais, monta os dados pelo mesmo caminho da
 * aplicação e renderiza os componentes de apresentação. NÃO toca no banco —
 * o motor de cálculo é chamado diretamente, então nada precisa ser gravado
 * nem desfeito.
 *
 * PRIVACIDADE: as asserções são sobre estrutura e contagem. Nenhum trecho de
 * HTML com dado de processo é impresso, nem em falha.
 *
 * Se as planilhas reais não estiverem presentes (CI, outra máquina), o teste
 * se declara pulado em vez de falhar — dados-reais/ é local e gitignored.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { lerPlanilha } from '@/lib/ingestao/ler-planilha'
import { consolidar, mesclarAcordos } from '@/lib/ingestao/consolidar'
import { calcularTodosCenarios } from '@/lib/calculo/cenarios'
import { calcularProjecao } from '@/lib/calculo/projecao'
import { calcularTop } from '@/lib/calculo/top-processos'
import {
  calcularTaxaExito,
  calcularTempoMedio,
  calcularRecorrencia,
  calcularEfeitoTeses,
  calcularConcentracaoMga,
} from '@/lib/calculo/kpis'
import type { DadosPainel } from '@/lib/painel/carregar'

import { Relatorio } from '@/app/relatorio/Relatorio'
import { VisaoExecutiva } from '@/app/VisaoExecutiva'
import { Painel } from '@/app/dashboard/Painel'

const DIR = path.join(process.cwd(), 'dados-reais')
const MES = '2026-07'

/** Localiza a planilha do tipo e mês, sem depender do nome exato. */
function achar(tipo: 'GERAL' | 'ACORDOS'): string | null {
  if (!fs.existsSync(DIR)) return null
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  const candidatos = fs.readdirSync(DIR).filter(f => {
    if (!f.toLowerCase().endsWith('.xlsx')) return false
    const n = norm(f)
    const ehAcordo = n.includes('ACORDO')
    return (tipo === 'ACORDOS' ? ehAcordo : !ehAcordo) && n.includes('JULHO-2026')
  })
  return candidatos.length === 1 ? path.join(DIR, candidatos[0]) : null
}

const geral = achar('GERAL')
const acordos = achar('ACORDOS')
const temDados = geral !== null && acordos !== null

/** Monta o mesmo objeto que `carregarPainel` entrega, sem passar pelo banco. */
function montarPainel(): DadosPainel {
  const lidoGeral = lerPlanilha(fs.readFileSync(geral!))
  const consGeral = consolidar(lidoGeral.linhas)
  const lidoAcordos = lerPlanilha(fs.readFileSync(acordos!))
  const consAcordos = consolidar(lidoAcordos.linhas)
  const { registros } = mesclarAcordos(consGeral.registros, consAcordos.registros)

  const n = (v: unknown) => (typeof v === 'number' ? v : null)
  const s = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null)
  const dt = (v: unknown) => (v instanceof Date ? v : null)
  const risco = (v: unknown) => (v as 'PROVAVEL' | 'POSSIVEL' | 'REMOTO' | null) ?? null

  return {
    importacao: {
      id: 'teste',
      mesReferencia: MES,
      concluidaEm: new Date('2026-08-05T12:00:00Z'),
      arquivoGeralNome: path.basename(geral!),
      totalPendencias: lidoGeral.pendencias.length + consGeral.pendencias.length,
    },
    totalProcessos: registros.length,
    cenarios: calcularTodosCenarios(
      registros.map(r => ({
        risco: risco(r.campos.risco),
        valorProvisionado: n(r.campos.valor_provisionado),
        encerrado: r.encerrado,
      }))
    ),
    projecao: calcularProjecao(
      registros.flatMap(r =>
        r.parcelas.map(p => ({ mesReferencia: p.mesReferencia, valor: p.valor }))
      ),
      MES
    ),
    top: calcularTop(
      registros.map((r, i) => ({
        id: String(i),
        numeroProcesso: s(r.numeroProcesso),
        carteira: r.carteira,
        area: s(r.campos.area),
        tipoAcao: s(r.campos.tipo_acao),
        risco: risco(r.campos.risco),
        encerrado: r.encerrado,
        valorCausa: n(r.campos.valor_causa),
        valorAcordo: n(r.campos.valor_acordo),
        valorCondenacao: n(r.campos.valor_condenacao),
        valorProvisionado: n(r.campos.valor_provisionado),
      }))
    ),
    exito: calcularTaxaExito(
      registros.map(r => ({
        valorCausa: n(r.campos.valor_causa),
        valorAcordo: n(r.campos.valor_acordo),
        valorCondenacao: n(r.campos.valor_condenacao),
        encerrado: r.encerrado,
        resultadoSentenca: s(r.campos.resultado_sentenca),
      }))
    ),
    tempo: calcularTempoMedio(
      registros.map(r => ({
        dataCadastro: dt(r.campos.data_cadastro),
        dataEncerramento: dt(r.campos.data_encerramento),
      }))
    ),
    recorrencia: calcularRecorrencia(registros.map(r => s(r.campos.tipo_acao)), 8),
    teses: calcularEfeitoTeses(
      registros.map(r => ({
        motivoSinistro: s(r.campos.motivo_sinistro),
        resultadoSentenca: s(r.campos.resultado_sentenca),
        poloCliente: s(r.campos.polo_cliente),
      }))
    ),
    mga: calcularConcentracaoMga(registros.map(r => s(r.campos.mga)), 8),
  }
}

/** Normaliza espaços: toLocaleString usa nbsp entre "R$" e o número. */
const norm = (s: string) => s.replace(/\s/g, ' ')

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

describe.skipIf(!temDados)('telas com a base real de julho/2026', () => {
  const painel = montarPainel()

  describe('Relatório Executivo', () => {
    const html = renderToStaticMarkup(<Relatorio dados={painel} />)

    it('renderiza as tabelas com linhas, não o estado vazio', () => {
      expect(html).not.toContain('Nenhuma importação concluída')
      const linhas = (html.match(/<tr class="[^"]*border-b/g) ?? []).length
      expect(linhas).toBeGreaterThan(10)
    })

    it('não deixa NaN nem undefined chegarem à tela', () => {
      // O erro clássico de Decimal→number aparece exatamente assim.
      expect(html).not.toMatch(/R\$\s*NaN/)
      expect(html).not.toContain('undefined')
      expect(html).not.toContain('NaN')
    })

    it('mostra as duas listas do Top com as contagens do motor', () => {
      expect(html).toContain(`${painel.top.trabalhistaEIdpj.length} processos`)
      expect(html).toContain(`${painel.top.topPorValor.length} de ${painel.top.elegiveisAoTop}`)
    })

    it('mascara o número de processo por padrão', () => {
      expect(html).toContain('•••••••')
    })

    it('dá caption a toda tabela, para leitor de tela', () => {
      const tabelas = (html.match(/<table/g) ?? []).length
      const captions = (html.match(/<caption/g) ?? []).length
      expect(tabelas).toBeGreaterThan(0)
      expect(captions).toBe(tabelas)
    })

    it('avisa quando um processo aparece nas duas listas', () => {
      const idsNoTop = new Set(painel.top.topPorValor.map(p => p.id))
      const nasDuas = painel.top.trabalhistaEIdpj.filter(p => idsNoTop.has(p.id)).length
      if (nasDuas > 0) {
        expect(html).toContain('não devem ser somadas')
      }
    })
  })

  describe('Visão Executiva', () => {
    const html = renderToStaticMarkup(<VisaoExecutiva dados={painel} />)

    it('mostra os três cenários com os valores do motor de cálculo', () => {
      const tela = norm(html)
      for (const c of ['CONSERVADOR', 'REALISTA', 'OTIMISTA'] as const) {
        expect(tela).toContain(norm(brl(painel.cenarios[c].totalProvisionado)))
      }
    })

    it('declara os processos que ficaram fora do cálculo', () => {
      // Um passivo menor por falta de dado é pior que um com ressalva.
      const fora = painel.totalProcessos - painel.cenarios.REALISTA.totalCasos
      if (fora > 0) {
        expect(html).toContain('ficaram fora do cálculo')
        expect(html).toContain('Nenhum deles foi somado como zero')
      }
    })

    it('não deixa NaN chegar à tela', () => {
      expect(html).not.toMatch(/R\$\s*NaN/)
      expect(html).not.toContain('NaN')
    })
  })

  describe('Dashboard', () => {
    const html = renderToStaticMarkup(
      <Painel
        dados={{
          mesReferencia: painel.importacao.mesReferencia,
          totalProcessos: painel.totalProcessos,
          cenarios: painel.cenarios,
          projecao: painel.projecao,
          recorrencia: painel.recorrencia,
          mga: painel.mga,
          exito: { percentual: painel.exito.percentual },
          tempo: { dias: painel.tempo.dias, medianaDias: painel.tempo.medianaDias },
        }}
      />
    )

    it('expõe o seletor de cenário como radiogroup navegável', () => {
      expect(html).toContain('role="radiogroup"')
      expect((html.match(/role="radio"/g) ?? []).length).toBe(3)
      expect(html).toContain('aria-checked="true"')
    })

    it('abre no cenário Realista', () => {
      expect(norm(html)).toContain(norm(brl(painel.cenarios.REALISTA.totalProvisionado)))
    })

    it('não deixa NaN chegar à tela', () => {
      expect(html).not.toMatch(/R\$\s*NaN/)
      expect(html).not.toContain('NaN')
    })
  })
})

describe.skipIf(temDados)('telas com a base real', () => {
  it('pulado: dados-reais/ não está presente nesta máquina', () => {
    expect(temDados).toBe(false)
  })
})
