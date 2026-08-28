import { Cartao } from '@/components/shell/Pagina'
import { CartaoValor, CartaoIndicador } from '@/components/dados/Numero'
import { ExplicacaoCenario } from '@/components/dados/SeletorCenario'
import { ROTULO_CENARIO, CENARIOS } from '@/lib/calculo/cenarios'
import { IconeAtencao } from '@/components/icones'
import type { DadosPainel } from '@/lib/painel/tipos'
import { brl, dataHora, inteiro, mesPorExtenso } from '@/lib/formato'

/**
 * Corpo da Visão Executiva — só apresentação, sem acesso ao banco.
 *
 * Mostra o passivo nos três cenários lado a lado, em vez de um número único
 * com seletor. A Diretoria decide olhando o intervalo; esconder dois terços
 * dele atrás de um controle transformaria uma faixa de incerteza numa falsa
 * precisão. O seletor existe no Dashboard, onde se explora um cenário por vez.
 */

export function VisaoExecutiva({ dados }: { dados: DadosPainel }) {
  const { importacao, totalProcessos, cenarios, projecao, exito, tempo, top } = dados
  const realista = cenarios.REALISTA

  return (
    <div className="space-y-6">
      <Cartao
        titulo="Provisionamento de risco"
        descricao="Os três cenários sobre a mesma carteira. O intervalo é a informação."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {CENARIOS.map(c => (
            <CartaoValor
              key={c}
              rotulo={ROTULO_CENARIO[c]}
              valor={brl(cenarios[c].totalProvisionado)}
              destaque={c === 'REALISTA'}
              nota={`${inteiro(cenarios[c].totalCasos)} processos considerados`}
            />
          ))}
        </div>

        <div className="mt-4 border-t border-borda pt-4">
          <ExplicacaoCenario cenario="REALISTA" />
        </div>

        <ForaDaConta
          excluidos={realista.excluidos}
          considerados={realista.totalCasos}
          total={totalProcessos}
        />
      </Cartao>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoValor
          rotulo="Desembolso projetado — 12 meses"
          valor={brl(projecao.horizontes[12].total)}
          nota={
            projecao.horizontes[12].incompleto
              ? `dados até ${projecao.ultimoMesComDados ?? '—'}`
              : `${projecao.horizontes[12].mesesComDados} meses com parcela`
          }
        />
        <CartaoIndicador
          rotulo="Taxa de êxito"
          indicador={exito.percentual}
          formatar={n => n.toFixed(1)}
          sufixo="%"
          descricaoBase={b => `${inteiro(b)} processos com sentença`}
        />
        <CartaoIndicador
          rotulo="Tempo médio de tramitação"
          indicador={tempo.dias}
          formatar={n => inteiro(Math.round(n))}
          sufixo=" dias"
          descricaoBase={b => `mediana ${tempo.medianaDias ?? '—'} · base ${inteiro(b)}`}
        />
        <CartaoValor
          rotulo="Processos em acompanhamento"
          valor={inteiro(top.trabalhistaEIdpj.length)}
          nota="Trabalhista e IDPJ, sem limite"
        />
      </div>

      <Cartao titulo="Procedência">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <ItemProcedencia rotulo="Mês de referência">
            {mesPorExtenso(importacao.mesReferencia)}
          </ItemProcedencia>
          <ItemProcedencia rotulo="Importado em">
            {importacao.concluidaEm
              ? dataHora(importacao.concluidaEm)
              : '—'}
          </ItemProcedencia>
          <ItemProcedencia rotulo="Arquivo de origem">
            {importacao.arquivoGeralNome ?? '—'}
          </ItemProcedencia>
          <ItemProcedencia rotulo="Pendências registradas">
            {inteiro(importacao.totalPendencias)}
          </ItemProcedencia>
        </dl>
      </Cartao>
    </div>
  )
}

function ItemProcedencia({
  rotulo,
  children,
}: {
  rotulo: string
  children: React.ReactNode
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-borda pb-2 last:border-0 sm:last:border-b">
      <dt className="text-texto-suave">{rotulo}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

/**
 * O que ficou de fora do provisionamento.
 *
 * O motor devolve os excluídos contados por motivo justamente para que este
 * bloco exista. Um passivo menor por falta de dado é pior que um passivo com
 * ressalva declarada — então a ressalva fica na tela, não no rodapé.
 */
function ForaDaConta({
  excluidos,
  considerados,
  total,
}: {
  excluidos: { encerrados: number; semRisco: number; semValor: number }
  considerados: number
  total: number
}) {
  const fora = total - considerados
  if (fora <= 0) return null

  return (
    <div className="mt-4 flex gap-3 rounded-ggp-sm bg-atencao-fundo p-3 text-sm text-atencao-texto">
      <IconeAtencao className="mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">
          {inteiro(fora)} de {inteiro(total)} processos ficaram fora do cálculo
        </p>
        <p className="mt-1">
          {inteiro(excluidos.encerrados)} encerrados · {inteiro(excluidos.semRisco)} sem
          classificação de risco · {inteiro(excluidos.semValor)} sem valor provisionado.
          Nenhum deles foi somado como zero.
        </p>
      </div>
    </div>
  )
}
