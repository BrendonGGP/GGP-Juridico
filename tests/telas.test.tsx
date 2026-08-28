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

import { painelDaBaseReal as painelDeTeste, temBaseReal } from './apoio/base-real'
import { brl } from '@/lib/formato'

import { Relatorio } from '@/app/relatorio/Relatorio'
import { VisaoExecutiva } from '@/app/VisaoExecutiva'
import { Painel } from '@/app/dashboard/Painel'

/** Normaliza espaços: toLocaleString usa nbsp entre "R$" e o número. */
const norm = (s: string) => s.replace(/\s/g, ' ')


/** Renderiza cada tela sob demanda, nunca no corpo do describe. */
const htmlRelatorio = () => renderToStaticMarkup(<Relatorio dados={painelDeTeste()} />)
const htmlVisao = () => renderToStaticMarkup(<VisaoExecutiva dados={painelDeTeste()} />)
const htmlDashboard = () => {
  const p = painelDeTeste()
  return renderToStaticMarkup(
    <Painel
      dados={{
        mesReferencia: p.importacao.mesReferencia,
        totalProcessos: p.totalProcessos,
        cenarios: p.cenarios,
        projecao: p.projecao,
        recorrencia: p.recorrencia,
        mga: p.mga,
        exito: { percentual: p.exito.percentual },
        tempo: { dias: p.tempo.dias, medianaDias: p.tempo.medianaDias },
      }}
    />
  )
}

describe.skipIf(!temBaseReal)('telas com a base real de julho/2026', () => {
  describe('Relatório Executivo', () => {
    it('renderiza as tabelas com linhas, não o estado vazio', () => {
      const html = htmlRelatorio()
      expect(html).not.toContain('Nenhuma importação concluída')
      const linhas = (html.match(/<tr class="[^"]*border-b/g) ?? []).length
      expect(linhas).toBeGreaterThan(10)
    })

    it('não deixa NaN nem undefined chegarem à tela', () => {
      // O erro clássico de Decimal→number aparece exatamente assim.
      const html = htmlRelatorio()
      expect(html).not.toMatch(/R\$\s*NaN/)
      expect(html).not.toContain('undefined')
      expect(html).not.toContain('NaN')
    })

    it('mostra as duas listas do Top com as contagens do motor', () => {
      const html = htmlRelatorio()
      const { top } = painelDeTeste()
      expect(html).toContain(`${top.trabalhistaEIdpj.length} processos`)
      expect(html).toContain(`${top.topPorValor.length} de ${top.elegiveisAoTop}`)
    })

    it('mascara o número de processo por padrão', () => {
      expect(htmlRelatorio()).toContain('•••••••')
    })

    it('dá caption a toda tabela, para leitor de tela', () => {
      const html = htmlRelatorio()
      const tabelas = (html.match(/<table/g) ?? []).length
      const captions = (html.match(/<caption/g) ?? []).length
      expect(tabelas).toBeGreaterThan(0)
      expect(captions).toBe(tabelas)
    })

    it('avisa quando um processo aparece nas duas listas', () => {
      const { top } = painelDeTeste()
      const idsNoTop = new Set(top.topPorValor.map(p => p.id))
      const nasDuas = top.trabalhistaEIdpj.filter(p => idsNoTop.has(p.id)).length
      if (nasDuas > 0) {
        expect(htmlRelatorio()).toContain('não devem ser somadas')
      }
    })
  })

  describe('Visão Executiva', () => {
    it('mostra os três cenários com os valores do motor de cálculo', () => {
      const tela = norm(htmlVisao())
      const { cenarios } = painelDeTeste()
      for (const c of ['CONSERVADOR', 'REALISTA', 'OTIMISTA'] as const) {
        expect(tela).toContain(norm(brl(cenarios[c].totalProvisionado)))
      }
    })

    it('declara os processos que ficaram fora do cálculo', () => {
      // Um passivo menor por falta de dado é pior que um com ressalva.
      const p = painelDeTeste()
      const fora = p.totalProcessos - p.cenarios.REALISTA.totalCasos
      if (fora > 0) {
        const html = htmlVisao()
        expect(html).toContain('ficaram fora do cálculo')
        expect(html).toContain('Nenhum deles foi somado como zero')
      }
    })

    it('não deixa NaN chegar à tela', () => {
      const html = htmlVisao()
      expect(html).not.toMatch(/R\$\s*NaN/)
      expect(html).not.toContain('NaN')
    })
  })

  describe('Dashboard', () => {
    it('expõe o seletor de cenário como radiogroup navegável', () => {
      const html = htmlDashboard()
      expect(html).toContain('role="radiogroup"')
      expect((html.match(/role="radio"/g) ?? []).length).toBe(3)
      expect(html).toContain('aria-checked="true"')
    })

    it('abre no cenário Realista', () => {
      const { cenarios } = painelDeTeste()
      expect(norm(htmlDashboard())).toContain(norm(brl(cenarios.REALISTA.totalProvisionado)))
    })

    it('não deixa NaN chegar à tela', () => {
      const html = htmlDashboard()
      expect(html).not.toMatch(/R\$\s*NaN/)
      expect(html).not.toContain('NaN')
    })
  })
})

describe.skipIf(temBaseReal)('telas com a base real', () => {
  it('pulado: dados-reais/ não está presente nesta máquina', () => {
    expect(temBaseReal).toBe(false)
  })
})
