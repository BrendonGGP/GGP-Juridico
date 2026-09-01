import { carregarPainel } from '@/lib/painel/carregar'
import { Pagina } from '@/components/shell/Pagina'
import { usuarioParaNavegacao } from '@/components/shell/usuario-para-nav'
import { SemDados } from '@/components/shell/SemDados'
import { inteiro } from '@/components/dados/Numero'
import { VisaoExecutiva } from './VisaoExecutiva'
import { mesPorExtenso } from '@/lib/formato'

/**
 * Visão Executiva — a tela de abertura.
 *
 * Busca os dados e entrega ao corpo da tela, que vive em VisaoExecutiva.tsx
 * para poder ser renderizado com dados de qualquer origem numa verificação.
 */

// Os números vêm do banco a cada requisição — nunca de cache estático.
export const dynamic = 'force-dynamic'

export default async function VisaoExecutivaPage() {
  const [dados, usuario] = await Promise.all([carregarPainel(), usuarioParaNavegacao()])

  if (!dados) {
    return (
      <Pagina usuario={usuario} titulo="Visão Executiva">
        <SemDados />
      </Pagina>
    )
  }

  return (
    <Pagina
      usuario={usuario}
      titulo="Visão Executiva"
      descricao={`Base de ${mesPorExtenso(dados.importacao.mesReferencia)} · ${inteiro(dados.totalProcessos)} processos`}
    >
      <VisaoExecutiva dados={dados} />
    </Pagina>
  )
}
