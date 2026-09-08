/**
 * Prévia dos indicadores na tela de importação.
 *
 * O que estes testes garantem:
 *
 *  - a tela renderiza os números da base real sem NaN, e o que aparece é o
 *    que o motor calculou (comparado valor a valor, não só "tem número");
 *  - a ressalva dos processos excluídos continua visível;
 *  - NENHUM processo é identificado. A prévia acontece antes de qualquer
 *    aprovação; número de processo e valor individual só no Relatório, depois
 *    de gravar.
 *
 * A garantia de que prévia e painel mostram os MESMOS números não é testada
 * aqui: ela vem da estrutura. Os dois caminhos chamam `montarPainel` sobre os
 * mesmos registros — a prévia via `de-planilha.ts`, o painel via
 * `de-banco.ts`. Duplicar a lógica em vez de reutilizá-la é o que quebraria
 * isso, e é o que a refatoração do motor único impede.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PreviaIndicadores } from '@/app/importacao/PreviaIndicadores'
import { painelDaBaseReal, temBaseReal } from './apoio/base-real'

describe.skipIf(!temBaseReal)('prévia de indicadores com a base real', () => {
  // Mesmo caminho da aplicação: adaptador de planilha + montarPainel.
  const painel = painelDaBaseReal

  const render = () => {
    const p = painel()
    return renderToStaticMarkup(
      <PreviaIndicadores
        totalProcessos={p.totalProcessos}
        indicadores={{
          cenarios: p.cenarios,
          projecao: {
            horizontes: p.projecao.horizontes,
            ultimoMesComDados: p.projecao.ultimoMesComDados,
            totalGeral: p.projecao.totalGeral,
            serie: p.projecao.serie,
          },
          exito: {
            percentual: p.exito.percentual,
            valorPedido: p.exito.valorPedido,
            valorDevido: p.exito.valorDevido,
            valorEconomizado: p.exito.valorEconomizado,
            processosComSentenca: p.exito.processosComSentenca,
          },
          tempo: p.tempo,
          recorrencia: p.recorrencia,
          mga: p.mga,
          top: {
            quantidadePorValor: p.top.topPorValor.length,
            elegiveisAoTop: p.top.elegiveisAoTop,
            quantidadeTrabalhistaIdpj: p.top.trabalhistaEIdpj.length,
          },
        }}
      />
    )
  }

  it('mostra os três cenários com os valores do motor', () => {
    const html = render()
    const p = painel()
    const brl = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    // nbsp entre "R$" e o número; normaliza os dois lados.
    const norm = (s: string) => s.replace(/\s/g, ' ')
    const tela = norm(html)

    for (const c of ['CONSERVADOR', 'REALISTA', 'OTIMISTA'] as const) {
      expect(tela).toContain(norm(brl(p.cenarios[c].totalProvisionado)))
    }

    /**
     * Contar as ocorrências, não só procurar a string.
     *
     * Sem isto o teste passava com o valor DOBRADO nos cartões: o número certo
     * continuava aparecendo na tabela do Relatório abaixo, e o `toContain`
     * ficava satisfeito. Verificado por mutação — multiplicar o valor por 2
     * agora falha, antes não falhava.
     *
     * Cada total aparece duas vezes por desenho: no cartão da Visão Executiva
     * e na tabela do Relatório.
     */
    for (const c of ['CONSERVADOR', 'REALISTA', 'OTIMISTA'] as const) {
      const alvo = norm(brl(p.cenarios[c].totalProvisionado))
      const vezes = tela.split(alvo).length - 1
      expect(vezes, `${c} deveria aparecer 2x (cartão e tabela), apareceu ${vezes}x`).toBe(2)
    }
  })

  it('não deixa NaN chegar à tela', () => {
    // O erro clássico quando um valor não atravessa a serialização JSON.
    const html = render()
    expect(html).not.toMatch(/R\$\s*NaN/)
    expect(html).not.toContain('NaN')
  })

  it('declara os processos que ficam fora do cenário', () => {
    const p = painel()
    const fora = p.totalProcessos - p.cenarios.REALISTA.totalCasos
    if (fora > 0) {
      expect(render()).toContain('Nenhum é somado como zero')
    }
  })

  it('NÃO expõe processo a processo', () => {
    // A prévia acontece antes de qualquer aprovação. Número de processo e
    // valor individual só aparecem no Relatório, depois de gravar.
    const html = render()
    const p = painel()

    // Nenhum número de processo do Top deve aparecer no HTML.
    for (const proc of p.top.topPorValor.slice(0, 5)) {
      if (proc.numeroProcesso) {
        expect(html, `número de processo vazou na prévia`).not.toContain(proc.numeroProcesso)
      }
    }
  })

  it('expõe o seletor de cenário como radiogroup', () => {
    const html = render()
    expect(html).toContain('role="radiogroup"')
    expect((html.match(/role="radio"/g) ?? []).length).toBe(3)
  })
})

describe.skipIf(temBaseReal)('prévia de indicadores', () => {
  it('pulado: dados-reais/ não está presente nesta máquina', () => {
    expect(temBaseReal).toBe(false)
  })
})
