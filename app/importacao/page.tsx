'use client'

import { useRef, useState } from 'react'

interface Pendencia {
  tipo: string
  aba: string
  linha?: number
  campo?: string
  detalhe: string
}

interface Resumo {
  abas: { nome: string; tipo: string; linhas: number }[]
  totalRegistros: number
  ativos: number
  encerrados: number
  comParcelas: number
  totalParcelas: number
  mesesDeParcela: string[]
  totalPendencias: number
  pendenciasPorTipo: { tipo: string; quantidade: number }[]
  reconciliacaoParaRevisar: number
  reconciliacaoExplicada: number
  acordosOrfaos: number
}

interface Preview {
  ok: true
  idempotencyKey: string
  mesReferencia: string
  avisos: string[]
  resumo: Resumo
  pendencias: Pendencia[]
}

const mesAtual = () => new Date().toISOString().slice(0, 7)

export default function ImportacaoPage() {
  const [mesReferencia, setMesReferencia] = useState(mesAtual)
  const [geral, setGeral] = useState<File | null>(null)
  const [acordos, setAcordos] = useState<File | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [erros, setErros] = useState<string[]>([])
  const resumoErrosRef = useRef<HTMLDivElement>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!geral) {
      setErros(['Selecione o Relatório Geral.'])
      // Acessibilidade: leva o foco ao resumo de erros após falha de envio.
      requestAnimationFrame(() => resumoErrosRef.current?.focus())
      return
    }

    setCarregando(true)
    setErros([])
    setPreview(null)

    const form = new FormData()
    form.set('mesReferencia', mesReferencia)
    form.set('relatorioGeral', geral)
    if (acordos) form.set('acordos', acordos)

    try {
      const res = await fetch('/api/importacao/preview', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok || json.ok === false) {
        setErros(json.erros ?? [json.erro ?? 'Falha ao processar a planilha.'])
        requestAnimationFrame(() => resumoErrosRef.current?.focus())
      } else {
        setPreview(json)
      }
    } catch {
      setErros(['Não foi possível falar com o servidor.'])
      requestAnimationFrame(() => resumoErrosRef.current?.focus())
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Importação mensal</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Envie o Relatório Geral e, se houver, a planilha de Acordos. Nada é gravado
        agora — você verá um resumo do que vai acontecer antes de confirmar.
      </p>

      {erros.length > 0 && (
        <div
          ref={resumoErrosRef}
          role="alert"
          tabIndex={-1}
          aria-labelledby="titulo-erros"
          className="mt-6 rounded-lg border-2 border-red-600 bg-red-50 p-4 dark:bg-red-950/40"
        >
          <h2 id="titulo-erros" className="font-semibold text-red-900 dark:text-red-200">
            A planilha não foi aceita
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900 dark:text-red-200">
            {erros.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={enviar} className="mt-8 space-y-6">
        <div>
          <label htmlFor="mes" className="block text-sm font-medium">
            Mês de referência
          </label>
          <input
            id="mes"
            type="month"
            required
            value={mesReferencia}
            onChange={e => setMesReferencia(e.target.value)}
            className="mt-1 min-h-11 rounded-md border border-neutral-400 bg-white px-3 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          />
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            É o mês da planilha, não a data de hoje.
          </p>
        </div>

        <CampoArquivo
          id="geral"
          rotulo="Relatório Geral"
          obrigatorio
          arquivo={geral}
          onChange={setGeral}
        />
        <CampoArquivo
          id="acordos"
          rotulo="Planilha de Acordos"
          descricao="Opcional — envie quando houver versão nova."
          arquivo={acordos}
          onChange={setAcordos}
        />

        <button
          type="submit"
          disabled={carregando}
          className="min-h-11 rounded-md bg-neutral-900 px-5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {carregando ? 'Analisando…' : 'Analisar planilha'}
        </button>
        <p aria-live="polite" className="sr-only">
          {carregando ? 'Analisando a planilha.' : preview ? 'Análise concluída.' : ''}
        </p>
      </form>

      {preview && <ResultadoPreview preview={preview} />}
    </main>
  )
}

function CampoArquivo({
  id,
  rotulo,
  descricao,
  obrigatorio,
  arquivo,
  onChange,
}: {
  id: string
  rotulo: string
  descricao?: string
  obrigatorio?: boolean
  arquivo: File | null
  onChange: (f: File | null) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {rotulo}
        {obrigatorio && <span className="text-red-700 dark:text-red-400"> *</span>}
      </label>
      {descricao && (
        <p className="text-xs text-neutral-600 dark:text-neutral-400">{descricao}</p>
      )}
      <input
        id={id}
        type="file"
        accept=".xlsx"
        required={obrigatorio}
        onChange={e => onChange(e.target.files?.[0] ?? null)}
        className="mt-1 block w-full min-h-11 text-sm file:mr-3 file:min-h-9 file:rounded-md file:border file:border-neutral-400 file:bg-neutral-50 file:px-3 file:text-sm dark:file:border-neutral-600 dark:file:bg-neutral-800 dark:file:text-neutral-100"
      />
      {arquivo && (
        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
          {arquivo.name} — {(arquivo.size / 1024 / 1024).toFixed(1)} MB
        </p>
      )}
    </div>
  )
}

function ResultadoPreview({ preview }: { preview: Preview }) {
  const r = preview.resumo
  const precisaAtencao =
    r.reconciliacaoParaRevisar > 0 || r.acordosOrfaos > 0 || r.totalPendencias > 0

  return (
    <section className="mt-10 space-y-8" aria-labelledby="titulo-preview">
      <h2 id="titulo-preview" className="text-xl font-semibold tracking-tight">
        O que vai ser importado
      </h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Indicador rotulo="Processos" valor={r.totalRegistros} />
        <Indicador rotulo="Ativos" valor={r.ativos} />
        <Indicador rotulo="Encerrados" valor={r.encerrados} />
        <Indicador rotulo="Parcelas" valor={r.totalParcelas} />
      </div>

      <div>
        <h3 className="text-sm font-semibold">Abas lidas</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <caption className="sr-only">Abas encontradas na planilha</caption>
            <thead>
              <tr className="border-b border-neutral-300 text-left dark:border-neutral-700">
                <th scope="col" className="py-2 pr-4 font-medium">Aba</th>
                <th scope="col" className="py-2 pr-4 font-medium">Tipo</th>
                <th scope="col" className="py-2 text-right font-medium">Linhas</th>
              </tr>
            </thead>
            <tbody>
              {r.abas.map(a => (
                <tr key={a.nome} className="border-b border-neutral-200 dark:border-neutral-800">
                  <td className="py-2 pr-4">{a.nome}</td>
                  <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400">
                    {a.tipo === 'GERAL' ? 'GERAL (não importada)' : a.tipo}
                  </td>
                  <td className="py-2 text-right tabular-nums">{a.linhas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {r.mesesDeParcela.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Meses de parcela detectados</h3>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            {r.mesesDeParcela.join(' · ')}
          </p>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            Meses já recebidos antes serão atualizados, não duplicados.
          </p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold">
          Pendências{' '}
          <span className="font-normal text-neutral-600 dark:text-neutral-400">
            — nenhuma impede a importação
          </span>
        </h3>

        {!precisaAtencao ? (
          <p className="mt-2 rounded-md border border-neutral-300 p-3 text-sm dark:border-neutral-700">
            Nada a revisar nesta planilha.
          </p>
        ) : (
          <>
            <ul className="mt-2 flex flex-wrap gap-2 text-xs">
              {r.reconciliacaoParaRevisar > 0 && (
                <Etiqueta texto={`${r.reconciliacaoParaRevisar} nº de processo a revisar`} />
              )}
              {r.reconciliacaoExplicada > 0 && (
                <Etiqueta
                  texto={`${r.reconciliacaoExplicada} repetição explicada por IDPJ`}
                  neutro
                />
              )}
              {r.acordosOrfaos > 0 && <Etiqueta texto={`${r.acordosOrfaos} acordo(s) órfão(s)`} />}
              {r.pendenciasPorTipo.map(t => (
                <Etiqueta key={t.tipo} texto={`${t.quantidade}× ${rotuloTipo(t.tipo)}`} />
              ))}
            </ul>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <caption className="sr-only">Detalhe das pendências encontradas</caption>
                <thead>
                  <tr className="border-b border-neutral-300 text-left dark:border-neutral-700">
                    <th scope="col" className="py-2 pr-4 font-medium">Aba</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Linha</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Campo</th>
                    <th scope="col" className="py-2 font-medium">O que foi encontrado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.pendencias.map((p, i) => (
                    <tr key={i} className="border-b border-neutral-200 align-top dark:border-neutral-800">
                      <td className="py-2 pr-4">{p.aba}</td>
                      <td className="py-2 pr-4 tabular-nums">{p.linha ?? '—'}</td>
                      <td className="py-2 pr-4">{p.campo ?? '—'}</td>
                      <td className="py-2">{p.detalhe}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
        <p className="text-sm">
          A gravação ainda não foi implementada nesta tela. O motor de ingestão está
          pronto e testado; a confirmação entra na próxima etapa, junto com a
          autenticação.
        </p>
      </div>
    </section>
  )
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
      <div className="text-2xl font-semibold tabular-nums">{valor.toLocaleString('pt-BR')}</div>
      <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{rotulo}</div>
    </div>
  )
}

/** Etiqueta com texto — o significado nunca depende só da cor. */
function Etiqueta({ texto, neutro }: { texto: string; neutro?: boolean }) {
  return (
    <li
      className={
        neutro
          ? 'rounded-full border border-neutral-400 px-2 py-1 dark:border-neutral-600'
          : 'rounded-full border border-amber-700 bg-amber-50 px-2 py-1 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
      }
    >
      {texto}
    </li>
  )
}

function rotuloTipo(tipo: string): string {
  const mapa: Record<string, string> = {
    VALOR_NAO_PARSEAVEL: 'valor não interpretável',
    LINHA_SEM_IDENTIFICADOR: 'linha sem identificador',
    COLUNA_NAO_RECONHECIDA: 'coluna sem mapeamento',
    COLUNA_DUPLICADA: 'coluna duplicada',
    ABA_NAO_RECONHECIDA: 'aba desconhecida',
    GERAL_DIVERGENTE: 'GERAL divergente',
    CONFLITO_BAIXADOS_ATIVA: 'conflito BAIXADOS/ativa',
    ACORDO_ORFAO: 'acordo órfão',
  }
  return mapa[tipo] ?? tipo
}
