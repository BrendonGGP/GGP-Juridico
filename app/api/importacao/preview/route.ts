import { NextResponse } from 'next/server'
import { prepararImportacao } from '@/lib/ingestao/importar'
import { LIMITES_PADRAO } from '@/lib/ingestao/validar-upload'
import { ehDesenvolvimento, authConfigurada } from '@/lib/config'
import { usuarioAtual, podeImportar } from '@/lib/auth/sessao'
import { registrar } from '@/lib/auth/auditoria'

/**
 * Passo 1 da importação: preview. NÃO grava nada.
 *
 * A importação é L3 na política de aprovação — o humano precisa ver o que vai
 * acontecer antes de autorizar. Esta rota produz esse retrato.
 *
 * A trava passou a ser de AUTORIZAÇÃO, não de ambiente: só ADMIN e JURIDICO
 * importam. Diretoria e Contabilidade consomem o resultado e não têm motivo
 * para reescrever a base do mês.
 *
 * O middleware já exige sessão para chegar aqui, mas a checagem é repetida:
 * uma rota de API não pode depender de outra camada ter feito o trabalho.
 * Se o matcher do middleware mudar por engano, esta continua fechada.
 */
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  /**
   * FAIL-CLOSED em duas frentes.
   *
   * Sem Supabase configurado não há como saber quem está importando. Em
   * desenvolvimento isso é tolerado — é como trabalhamos até aqui. Em
   * qualquer outro ambiente, bloqueia: gravar sem autor produziria um
   * histórico incapaz de responder "quem substituiu a base de julho?".
   */
  if (!authConfigurada) {
    if (!ehDesenvolvimento) {
      return NextResponse.json(
        { erro: 'Importação indisponível: autenticação não configurada.' },
        { status: 503 }
      )
    }
  } else {
    const usuario = await usuarioAtual()

    if (!usuario) {
      return NextResponse.json({ erro: 'Sessão expirada. Entre novamente.' }, { status: 401 })
    }

    if (!podeImportar(usuario)) {
      await registrar({
        usuarioId: usuario.id,
        acao: 'IMPORTACAO_NEGADA',
        detalhe: { perfil: usuario.perfil },
      })
      return NextResponse.json(
        { erro: 'Seu perfil não permite importar planilhas.' },
        { status: 403 }
      )
    }
  }

  // Barra o corpo grande ANTES de materializá-lo na memória.
  const tamanho = Number(req.headers.get('content-length') ?? 0)
  const tetoTotal = LIMITES_PADRAO.tamanhoMaximoBytes * 2 + 1024 * 1024
  if (tamanho > tetoTotal) {
    return NextResponse.json(
      { erro: `Envio maior que o limite de ${Math.round(tetoTotal / 1024 / 1024)} MB.` },
      { status: 413 }
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ erro: 'Envio inválido.' }, { status: 400 })
  }

  const mesReferencia = String(form.get('mesReferencia') ?? '')
  const geral = form.get('relatorioGeral')
  const acordos = form.get('acordos')

  if (!(geral instanceof File)) {
    return NextResponse.json(
      { erro: 'Envie o Relatório Geral (.xlsx).' },
      { status: 400 }
    )
  }

  const preparacao = prepararImportacao({
    mesReferencia,
    relatorioGeral: {
      nome: geral.name,
      conteudo: Buffer.from(await geral.arrayBuffer()),
    },
    acordos:
      acordos instanceof File && acordos.size > 0
        ? { nome: acordos.name, conteudo: Buffer.from(await acordos.arrayBuffer()) }
        : undefined,
  })

  if (!preparacao.ok) {
    return NextResponse.json(
      { ok: false, erros: preparacao.erros, avisos: preparacao.avisos },
      { status: 422 }
    )
  }

  // A resposta leva apenas o RESUMO e as pendências — nunca os registros, que
  // carregam nome de parte, placa, apólice e valores por processo.
  return NextResponse.json({
    ok: true,
    idempotencyKey: preparacao.idempotencyKey,
    mesReferencia: preparacao.mesReferencia,
    avisos: preparacao.avisos,
    resumo: preparacao.resumo,
    pendencias: [
      ...preparacao.pendencias,
      ...preparacao.registros.flatMap(r => r.pendencias),
    ].slice(0, 500),
  })
}
