import { NextResponse } from 'next/server'
import { prepararImportacao } from '@/lib/ingestao/importar'
import { LIMITES_PADRAO } from '@/lib/ingestao/validar-upload'
import { ehDesenvolvimento } from '@/lib/config'

/**
 * Passo 1 da importação: preview. NÃO grava nada.
 *
 * A importação é L3 na política de aprovação — o humano precisa ver o que vai
 * acontecer antes de autorizar. Esta rota produz esse retrato.
 *
 * TODO(Fase 6): exigir sessão autenticada com perfil que permita importar.
 * Enquanto a autenticação não existe, a rota fica restrita a desenvolvimento.
 */
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  // FAIL-CLOSED: libera apenas em desenvolvimento declarado.
  //
  // A versão anterior bloqueava com `APP_ENV === 'production'` — uma
  // comparação de string solta. Se a variável viesse `Production`, `prod` ou
  // ausente, a condição dava falso e a rota ABRIA. Numa trava que existe
  // porque a autenticação ainda não foi construída, errar para o lado aberto
  // é o pior desfecho possível.
  //
  // Agora o padrão é negar: só passa quando o ambiente é reconhecidamente
  // development (enum validado em lib/config.ts).
  if (!ehDesenvolvimento) {
    return NextResponse.json(
      { erro: 'Importação indisponível: autenticação ainda não implementada.' },
      { status: 503 }
    )
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
