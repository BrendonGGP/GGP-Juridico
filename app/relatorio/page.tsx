import { carregarPainel } from '@/lib/painel/carregar'
import { Pagina } from '@/components/shell/Pagina'
import { usuarioParaNavegacao } from '@/components/shell/usuario-para-nav'
import { SemDados } from '@/components/shell/SemDados'
import { inteiro } from '@/components/dados/Numero'
import { Relatorio } from './Relatorio'
import { mesPorExtenso } from '@/lib/formato'

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
  const [dados, usuario] = await Promise.all([carregarPainel(), usuarioParaNavegacao()])

  if (!dados) {
    return (
      <Pagina usuario={usuario} titulo="Relatório Executivo">
        <SemDados />
      </Pagina>
    )
  }

  return (
    <Pagina
      usuario={usuario}
      titulo="Relatório Executivo"
      descricao={`Base de ${mesPorExtenso(dados.importacao.mesReferencia)} · ${inteiro(dados.totalProcessos)} processos`}
    >
      <Relatorio dados={dados} />
    </Pagina>
  )
}
