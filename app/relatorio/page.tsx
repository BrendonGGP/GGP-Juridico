import { carregarPainel } from '@/lib/painel/carregar'
import { Pagina } from '@/components/shell/Pagina'
import { SemDados } from '@/components/shell/SemDados'
import { inteiro } from '@/components/dados/Numero'
import { Relatorio, mesPorExtenso } from './Relatorio'

/**
 * Relatório Executivo — busca os dados e entrega ao corpo da tela.
 *
 * A apresentação vive em Relatorio.tsx, separada para poder ser renderizada
 * com dados de qualquer origem numa verificação.
 *
 * A página é desenhada para impressão: a navegação some e os cartões viram
 * blocos planos (ver @media print em globals.css).
 */

export const dynamic = 'force-dynamic'

export default async function RelatorioPage() {
  const dados = await carregarPainel()

  if (!dados) {
    return (
      <Pagina titulo="Relatório Executivo">
        <SemDados />
      </Pagina>
    )
  }

  return (
    <Pagina
      titulo="Relatório Executivo"
      descricao={`Base de ${mesPorExtenso(dados.importacao.mesReferencia)} · ${inteiro(dados.totalProcessos)} processos`}
    >
      <Relatorio dados={dados} />
    </Pagina>
  )
}
