import { NextResponse } from 'next/server'
import { prepararImportacao } from '@/lib/ingestao/importar'
import { gravarImportacao } from '@/lib/ingestao/gravar'
import { LIMITES_PADRAO } from '@/lib/ingestao/validar-upload'
import { prisma } from '@/lib/db'
import { ehDesenvolvimento, authConfigurada } from '@/lib/config'
import { usuarioAtual, podeImportar } from '@/lib/auth/sessao'
import { registrar } from '@/lib/auth/auditoria'

/**
 * Passo 2 da importação: GRAVA.
 *
 * A planilha é REPROCESSADA aqui, não recebida pronta do navegador.
 *
 * Poderia parecer desperdício — o preview já leu o arquivo. Mas confiar nos
 * dados que o cliente devolve significa aceitar como verdade um JSON que
 * qualquer pessoa pode editar antes de enviar: valores de provisionamento,
 * risco, número de processo. Num sistema que calcula passivo jurídico, a
 * fonte tem de ser o arquivo, sempre.
 *
 * O `idempotencyKey` vem do conteúdo do arquivo (hash), não do cliente. Se o
 * mesmo arquivo já foi importado, `gravarImportacao` devolve `jaImportado` e
 * não cria um segundo snapshot — REGRA 6.
 *
 * O que esta rota NÃO faz: sobrescrever histórico. Cada importação vira um
 * snapshot novo; as anteriores permanecem para comparação entre meses.
 */
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  // --- Autorização: mesma trava do preview ---------------------------------
  //
  // Repetida aqui de propósito. Uma rota de API não pode depender de outra
  // camada ter feito a checagem: se o matcher do proxy mudar por engano, esta
  // continua fechada. E gravar é mais grave que apenas ler.
  let usuarioId: string | undefined

  if (!authConfigurada) {
    if (!ehDesenvolvimento) {
      return NextResponse.json(
        { erro: 'Importação indisponível: autenticação não configurada.' },
        { status: 503 }
      )
    }
    // Em desenvolvimento sem autenticação, a importação fica registrada SEM
    // autor. Não se inventa um usuário: a tela de procedência mostra "não
    // identificado", e quem olhar o histórico sabe que aquela carga não tem
    // assinatura.
  } else {
    const usuario = await usuarioAtual()

    if (!usuario) {
      return NextResponse.json({ erro: 'Sessão expirada. Entre novamente.' }, { status: 401 })
    }
    if (!podeImportar(usuario)) {
      await registrar({
        usuarioId: usuario.id,
        acao: 'IMPORTACAO_NEGADA',
        detalhe: { perfil: usuario.perfil, etapa: 'confirmacao' },
      })
      return NextResponse.json(
        { erro: 'Seu perfil não permite importar planilhas.' },
        { status: 403 }
      )
    }
    usuarioId = usuario.id
  }

  // --- Entrada --------------------------------------------------------------
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
  /**
   * Chave que o preview mostrou. Serve para CONFERIR, não para confiar: se o
   * arquivo tiver mudado entre analisar e confirmar, os hashes divergem e a
   * gravação é recusada. Sem isso, alguém poderia aprovar uma planilha e
   * enviar outra.
   */
  const chaveEsperada = String(form.get('idempotencyKey') ?? '')

  if (!(geral instanceof File)) {
    return NextResponse.json({ erro: 'Envie o Relatório Geral (.xlsx).' }, { status: 400 })
  }

  // --- Reprocessa a partir do arquivo --------------------------------------
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

  if (chaveEsperada && chaveEsperada !== preparacao.idempotencyKey) {
    return NextResponse.json(
      {
        erro:
          'O arquivo mudou desde a análise. Analise novamente antes de confirmar.',
      },
      { status: 409 }
    )
  }

  // --- Grava ----------------------------------------------------------------
  try {
    const r = await gravarImportacao(prisma, {
      mesReferencia: preparacao.mesReferencia,
      idempotencyKey: preparacao.idempotencyKey,
      registros: preparacao.registros,
      pendencias: preparacao.pendencias,
      reconciliacao: preparacao.reconciliacao,
      orfaos: preparacao.orfaos,
      usuarioId,
      arquivoGeralNome: geral.name,
      arquivoGeralHash: preparacao.hashGeral,
      arquivoAcordosNome: acordos instanceof File ? acordos.name : undefined,
      arquivoAcordosHash: preparacao.hashAcordos ?? undefined,
    })

    // Concluída, para o painel passar a enxergá-la. `CONCLUIDA_COM_PENDENCIAS`
    // quando houver algo a revisar — pendência não bloqueia a importação
    // (REGRA 10), mas fica declarada no status.
    if (r.importacaoId && !r.jaImportado) {
      await prisma.importacao.update({
        where: { id: r.importacaoId },
        data: {
          status:
            preparacao.resumo.totalPendencias > 0
              ? 'CONCLUIDA_COM_PENDENCIAS'
              : 'CONCLUIDA',
          concluidaEm: new Date(),
        },
      })
    }

    await registrar({
      usuarioId,
      acao: r.jaImportado ? 'IMPORTACAO_REPETIDA' : 'IMPORTACAO_CONFIRMADA',
      alvo: r.importacaoId ?? undefined,
      // Só contagens. Nenhum processo é identificado no log.
      detalhe: {
        mesReferencia: preparacao.mesReferencia,
        processosNovos: r.processosNovos,
        processosAtualizados: r.processosAtualizados,
        snapshots: r.snapshotsGravados,
        parcelasInseridas: r.parcelasInseridas,
        parcelasAtualizadas: r.parcelasAtualizadas,
        pendencias: preparacao.resumo.totalPendencias,
        semAutor: usuarioId === undefined,
      },
    })

    return NextResponse.json({
      ok: true,
      jaImportado: r.jaImportado,
      importacaoId: r.importacaoId,
      mesReferencia: preparacao.mesReferencia,
      processosNovos: r.processosNovos,
      processosAtualizados: r.processosAtualizados,
      snapshotsGravados: r.snapshotsGravados,
      parcelasInseridas: r.parcelasInseridas,
      parcelasAtualizadas: r.parcelasAtualizadas,
      semAutor: usuarioId === undefined,
    })
  } catch (e) {
    // A mensagem do banco pode conter fragmento de dado. Vai para o log do
    // servidor, nunca para a resposta.
    console.error('[importacao/confirmar] falha ao gravar', e)
    await registrar({
      usuarioId,
      acao: 'IMPORTACAO_FALHOU',
      detalhe: { mesReferencia: preparacao.mesReferencia },
    })
    return NextResponse.json(
      { erro: 'Não foi possível gravar a importação. Nada foi alterado.' },
      { status: 500 }
    )
  }
}
