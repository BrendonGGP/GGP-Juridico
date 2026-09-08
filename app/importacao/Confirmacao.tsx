'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IconeAtencao } from '@/components/icones'
import { inteiro } from '@/lib/formato'

/**
 * Confirmação da importação — o passo que GRAVA.
 *
 * Fica separada do formulário de análise porque são decisões diferentes:
 * analisar é reversível e não toca no banco; confirmar substitui a foto do
 * mês. O texto do botão diz o que vai acontecer, não "OK".
 *
 * Os arquivos são REENVIADOS na confirmação, e o servidor os reprocessa. Não
 * é desperdício: aceitar o resultado que o navegador devolve significaria
 * confiar num JSON que qualquer pessoa pode editar antes de mandar. Num
 * sistema que calcula passivo jurídico, a fonte é sempre o arquivo.
 *
 * A `idempotencyKey` da análise vai junto para o servidor CONFERIR. Se o
 * arquivo tiver mudado entre analisar e confirmar, os hashes divergem e a
 * gravação é recusada — sem isso, alguém poderia aprovar uma planilha e
 * enviar outra.
 */

export interface ResultadoGravacao {
  jaImportado: boolean
  mesReferencia: string
  processosNovos: number
  processosAtualizados: number
  snapshotsGravados: number
  parcelasInseridas: number
  parcelasAtualizadas: number
  semAutor: boolean
}

export function Confirmacao({
  mesReferencia,
  idempotencyKey,
  geral,
  acordos,
  totalProcessos,
  totalPendencias,
  semAutenticacao,
}: {
  mesReferencia: string
  idempotencyKey: string
  geral: File
  acordos: File | null
  totalProcessos: number
  totalPendencias: number
  /** Sem sessão, a importação fica sem autor. A tela precisa dizer isso. */
  semAutenticacao: boolean
}) {
  const router = useRouter()
  const [gravando, setGravando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoGravacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const avisoRef = useRef<HTMLDivElement>(null)

  async function confirmar() {
    setGravando(true)
    setErro(null)

    const form = new FormData()
    form.set('mesReferencia', mesReferencia)
    form.set('idempotencyKey', idempotencyKey)
    form.set('relatorioGeral', geral)
    if (acordos) form.set('acordos', acordos)

    try {
      const res = await fetch('/api/importacao/confirmar', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok || json.ok === false) {
        setErro(json.erro ?? json.erros?.join(' ') ?? 'Falha ao gravar.')
        requestAnimationFrame(() => avisoRef.current?.focus())
      } else {
        setResultado(json)
        // O painel lê do banco a cada requisição; sem isto as telas ainda
        // mostrariam o cache da navegação anterior.
        router.refresh()
      }
    } catch {
      setErro('Não foi possível falar com o servidor. Nada foi gravado.')
      requestAnimationFrame(() => avisoRef.current?.focus())
    } finally {
      setGravando(false)
    }
  }

  if (resultado) {
    return <Gravado resultado={resultado} />
  }

  return (
    <section className="mt-10 rounded-ggp border-2 border-primaria bg-primaria-suave p-5">
      <h2 className="text-lg font-semibold tracking-tight">Confirmar a importação</h2>
      <p className="mt-1 text-sm text-texto-suave">
        Isto grava {inteiro(totalProcessos)} processos como a foto de{' '}
        {mesReferencia}. As importações anteriores continuam no histórico — nada
        é sobrescrito.
      </p>

      {totalPendencias > 0 && (
        <p className="mt-3 text-sm text-texto-suave">
          As {inteiro(totalPendencias)} pendências não impedem a gravação. Elas
          ficam registradas para revisão.
        </p>
      )}

      {semAutenticacao && (
        <div className="mt-4 flex gap-3 rounded-ggp-sm bg-atencao-fundo p-3 text-sm text-atencao-texto">
          <IconeAtencao className="mt-0.5 shrink-0" />
          <p>
            A autenticação ainda não está configurada, então esta importação
            será registrada <strong>sem autor</strong>. Ela aparecerá como
            &ldquo;não identificado&rdquo; no histórico.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={confirmar}
        disabled={gravando}
        className="mt-5 min-h-11 cursor-pointer rounded-ggp-sm bg-primaria px-6 text-sm font-semibold text-sobre-primaria transition-colors duration-150 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {gravando ? 'Gravando…' : `Gravar a importação de ${mesReferencia}`}
      </button>

      <p aria-live="polite" className="sr-only">
        {gravando ? 'Gravando a importação.' : ''}
      </p>

      {erro && (
        <div
          ref={avisoRef}
          role="alert"
          tabIndex={-1}
          className="mt-4 rounded-ggp-sm border border-[var(--cor-erro-texto)] bg-erro-fundo p-3 text-sm text-erro-texto"
        >
          {erro}
        </div>
      )}
    </section>
  )
}

function Gravado({ resultado: r }: { resultado: ResultadoGravacao }) {
  return (
    <section
      role="status"
      className="mt-10 rounded-ggp border-2 border-primaria bg-primaria-suave p-5"
    >
      <h2 className="text-lg font-semibold tracking-tight text-primaria-texto">
        {r.jaImportado
          ? 'Esta planilha já havia sido importada'
          : `Importação de ${r.mesReferencia} gravada`}
      </h2>

      {r.jaImportado ? (
        <p className="mt-1 text-sm text-texto-suave">
          O conteúdo é idêntico ao de uma importação anterior, então nada foi
          duplicado. Os dados no sistema já refletem esta planilha.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Item rotulo="Processos novos">{inteiro(r.processosNovos)}</Item>
            <Item rotulo="Processos atualizados">{inteiro(r.processosAtualizados)}</Item>
            <Item rotulo="Snapshots gravados">{inteiro(r.snapshotsGravados)}</Item>
            <Item rotulo="Parcelas inseridas">{inteiro(r.parcelasInseridas)}</Item>
            <Item rotulo="Parcelas atualizadas">{inteiro(r.parcelasAtualizadas)}</Item>
          </dl>

          {r.semAutor && (
            <p className="mt-4 rounded-ggp-sm bg-atencao-fundo p-3 text-xs text-atencao-texto">
              Registrada sem autor — a autenticação não estava configurada.
            </p>
          )}
        </>
      )}

      <p className="mt-5 text-sm">
        Os indicadores já estão disponíveis em{' '}
        <Link href="/" className="font-medium text-primaria-texto underline underline-offset-2">
          Visão Executiva
        </Link>
        ,{' '}
        <Link
          href="/dashboard"
          className="font-medium text-primaria-texto underline underline-offset-2"
        >
          Dashboard
        </Link>{' '}
        e{' '}
        <Link
          href="/relatorio"
          className="font-medium text-primaria-texto underline underline-offset-2"
        >
          Relatório Executivo
        </Link>
        .
      </p>
    </section>
  )
}

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-borda pb-1">
      <dt className="text-texto-suave">{rotulo}</dt>
      <dd className="font-semibold tabular-nums">{children}</dd>
    </div>
  )
}
