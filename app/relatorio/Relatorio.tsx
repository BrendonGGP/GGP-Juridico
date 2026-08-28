import { Cartao } from '@/components/shell/Pagina'
import { brl, inteiro } from '@/components/dados/Numero'
import { Tabela, Linha, Celula, NumeroProcesso } from '@/components/dados/Tabela'
import { PilulaRisco, Etiqueta } from '@/components/dados/PilulaRisco'
import { ROTULO_CENARIO, CENARIOS } from '@/lib/calculo/cenarios'
import { LIMITE_TOP, VALOR_MINIMO_TOP } from '@/lib/calculo/top-processos'
import type { DadosPainel } from '@/lib/painel/carregar'

/**
 * Corpo do Relatório Executivo — só apresentação, sem acesso ao banco.
 *
 * Separado da página para que possa ser renderizado com dados de qualquer
 * origem. É o que permite verificar a tela com a base real sem gravar nada
 * de forma permanente (scripts/testar-telas.ts).
 *
 * DUAS listas independentes, conforme decidido com a coordenadora em
 * 11/08/2026 (ver lib/calculo/top-processos.ts):
 *
 *   1. Top 20 por valor — os maiores acima de R$ 100 mil.
 *   2. Trabalhista + IDPJ completo — todos, sem limite, porque o motivo de
 *      acompanhá-los é a natureza jurídica e não o valor.
 *
 * Um processo pode aparecer nas duas. A tela diz quantos, para ninguém somar
 * as listas e contar processo duas vezes.
 */

const NOMES_MES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function mesPorExtenso(mes: string): string {
  const [ano, m] = mes.split('-')
  const nome = NOMES_MES[Number(m) - 1]
  return nome ? `${nome} de ${ano}` : mes
}

const ORIGEM: Record<string, string> = {
  acordo: 'Acordo',
  condenacao: 'Condenação',
  provisionado: 'Provisionado',
  causa: 'Valor da causa',
  nenhum: 'Sem valor',
}

export function Relatorio({ dados }: { dados: DadosPainel }) {
  const { importacao, cenarios, top, exito, tempo, projecao } = dados

  const idsNoTop = new Set(top.topPorValor.map(p => p.id))
  const nasDuasListas = top.trabalhistaEIdpj.filter(p => idsNoTop.has(p.id)).length

  return (
    <div className="space-y-6">
      <Cartao titulo="Síntese" descricao="Provisionamento nos três cenários.">
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
              <Celula numerico>{inteiro(cenarios[c].totalCasos)}</Celula>
              <Celula numerico className={c === 'REALISTA' ? 'font-semibold' : ''}>
                {brl(cenarios[c].totalProvisionado)}
              </Celula>
            </Linha>
          ))}
        </Tabela>

        <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-borda pt-4 text-sm sm:grid-cols-3">
          <ItemSintese rotulo="Desembolso — 12 meses">
            {brl(projecao.horizontes[12].total)}
          </ItemSintese>
          <ItemSintese rotulo="Taxa de êxito">
            {exito.percentual.valor !== null
              ? `${exito.percentual.valor.toFixed(1)}%`
              : (exito.percentual.indisponivel ?? '—')}
          </ItemSintese>
          <ItemSintese rotulo="Tempo médio">
            {tempo.dias.valor !== null
              ? `${inteiro(Math.round(tempo.dias.valor))} dias`
              : (tempo.dias.indisponivel ?? '—')}
          </ItemSintese>
        </dl>
      </Cartao>

      <Cartao
        titulo={`Top ${LIMITE_TOP} por valor`}
        descricao={`Acima de ${brl(VALOR_MINIMO_TOP)}, risco Provável ou Possível, em andamento. ${inteiro(top.topPorValor.length)} de ${inteiro(top.elegiveisAoTop)} elegíveis.`}
      >
        <Tabela
          legenda={`Os ${inteiro(top.topPorValor.length)} processos de maior valor`}
          larguraMinima="46rem"
          cabecalho={[
            { rotulo: '#', numerico: true },
            { rotulo: 'Processo' },
            { rotulo: 'Carteira' },
            { rotulo: 'Área' },
            { rotulo: 'Risco' },
            { rotulo: 'Valor', numerico: true },
            { rotulo: 'Origem' },
          ]}
          vazio={
            top.topPorValor.length === 0
              ? 'Nenhum processo atinge os critérios do Top nesta base.'
              : undefined
          }
        >
          {top.topPorValor.map((p, i) => (
            <Linha key={p.id}>
              <Celula numerico className="text-texto-suave">
                {i + 1}
              </Celula>
              <Celula>
                <NumeroProcesso numero={p.numeroProcesso} />
              </Celula>
              <Celula className="text-texto-suave">{p.carteira ?? '—'}</Celula>
              <Celula>{p.area ?? '—'}</Celula>
              <Celula>
                <PilulaRisco risco={p.risco} />
              </Celula>
              <Celula numerico className="font-semibold">
                {brl(p.valorRanqueamento)}
              </Celula>
              <Celula className="text-texto-suave">{ORIGEM[p.origemValor]}</Celula>
            </Linha>
          ))}
        </Tabela>
        <p className="mt-3 text-xs text-texto-suave">
          A coluna Origem diz de onde veio o valor. Acordo e condenação nunca são
          somados — o acordo substitui a condenação quando existe.
        </p>
      </Cartao>

      <Cartao
        titulo="Trabalhista e IDPJ"
        descricao={`Todos, sem limite de quantidade. ${inteiro(top.trabalhistaEIdpj.length)} processos.`}
      >
        <Tabela
          legenda="Processos trabalhistas e incidentes de desconsideração da personalidade jurídica"
          larguraMinima="46rem"
          cabecalho={[
            { rotulo: 'Processo' },
            { rotulo: 'Natureza' },
            { rotulo: 'Carteira' },
            { rotulo: 'Tipo de ação' },
            { rotulo: 'Risco' },
            { rotulo: 'Valor', numerico: true },
          ]}
          vazio={
            top.trabalhistaEIdpj.length === 0
              ? 'Nenhum processo trabalhista ou IDPJ em andamento nesta base.'
              : undefined
          }
        >
          {top.trabalhistaEIdpj.map(p => (
            <Linha key={p.id}>
              <Celula>
                <NumeroProcesso numero={p.numeroProcesso} />
              </Celula>
              <Celula>
                <span className="flex flex-wrap gap-1">
                  {p.ehTrabalhista && <Etiqueta texto="Trabalhista" />}
                  {p.ehIdpj && <Etiqueta texto="IDPJ" />}
                </span>
              </Celula>
              <Celula className="text-texto-suave">{p.carteira ?? '—'}</Celula>
              <Celula>{p.tipoAcao ?? '—'}</Celula>
              <Celula>
                <PilulaRisco risco={p.risco} />
              </Celula>
              <Celula numerico>{brl(p.valorRanqueamento)}</Celula>
            </Linha>
          ))}
        </Tabela>

        {nasDuasListas > 0 && (
          <p className="mt-3 text-xs text-texto-suave">
            {inteiro(nasDuasListas)} destes processos também aparecem no Top por
            valor. As duas listas são independentes — não devem ser somadas.
          </p>
        )}
      </Cartao>

      <Cartao titulo="Procedência do dado">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <ItemSintese rotulo="Mês de referência">
            {mesPorExtenso(importacao.mesReferencia)}
          </ItemSintese>
          <ItemSintese rotulo="Importado em">
            {importacao.concluidaEm
              ? importacao.concluidaEm.toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : '—'}
          </ItemSintese>
          <ItemSintese rotulo="Arquivo de origem">
            {importacao.arquivoGeralNome ?? '—'}
          </ItemSintese>
          <ItemSintese rotulo="Pendências registradas">
            {inteiro(importacao.totalPendencias)}
          </ItemSintese>
        </dl>
        <p className="mt-4 border-t border-borda pt-3 text-xs text-texto-suave">
          Números de processo aparecem parcialmente ocultados. Documento de uso
          interno do Jurídico.
        </p>
      </Cartao>
    </div>
  )
}

function ItemSintese({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-borda pb-2 sm:block sm:border-0 sm:pb-0">
      <dt className="text-texto-suave">{rotulo}</dt>
      <dd className="font-semibold sm:mt-0.5 sm:text-lg">{children}</dd>
    </div>
  )
}
