import { Suspense } from 'react'
import { carregarPainel } from '@/lib/painel/carregar'
import { Pagina } from '@/components/shell/Pagina'
import { usuarioParaNavegacao } from '@/components/shell/usuario-para-nav'
import { SemDados } from '@/components/shell/SemDados'
import { inteiro } from '@/components/dados/Numero'
import { PainelComUrl } from './Painel'
import { mesPorExtenso } from '@/lib/formato'

/**
 * Dashboard — exploração de um cenário por vez.
 *
 * Diferente da Visão Executiva, que mostra os três lado a lado: aqui a
 * pergunta é "como este cenário se decompõe", e para isso um cenário por vez
 * é mais legível.
 *
 * O servidor calcula os três e entrega tudo; o cliente só escolhe qual
 * exibir. Trocar de cenário não custa uma ida ao banco.
 */

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [dados, usuario] = await Promise.all([carregarPainel(), usuarioParaNavegacao()])

  if (!dados) {
    return (
      <Pagina usuario={usuario} titulo="Dashboard">
        <SemDados />
      </Pagina>
    )
  }

  return (
    <Pagina
      usuario={usuario}
      titulo="Dashboard"
      descricao={`Base de ${mesPorExtenso(dados.importacao.mesReferencia)} · ${inteiro(dados.totalProcessos)} processos`}
    >
      {/* useSearchParams exige limite de Suspense no App Router. */}
      <Suspense fallback={<CarregandoPainel />}>
        <PainelComUrl
          dados={{
            mesReferencia: dados.importacao.mesReferencia,
            totalProcessos: dados.totalProcessos,
            cenarios: {
              CONSERVADOR: dados.cenarios.CONSERVADOR,
              REALISTA: dados.cenarios.REALISTA,
              OTIMISTA: dados.cenarios.OTIMISTA,
            },
            projecao: {
              serie: dados.projecao.serie,
              horizontes: dados.projecao.horizontes,
              ultimoMesComDados: dados.projecao.ultimoMesComDados,
            },
            recorrencia: dados.recorrencia,
            mga: dados.mga,
            exito: { percentual: dados.exito.percentual },
            tempo: { dias: dados.tempo.dias, medianaDias: dados.tempo.medianaDias },
          }}
        />
      </Suspense>
    </Pagina>
  )
}

function CarregandoPainel() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-ggp border border-borda bg-superficie p-10 text-center text-sm text-texto-suave"
    >
      Carregando indicadores…
    </div>
  )
}
