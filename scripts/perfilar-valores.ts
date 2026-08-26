/**
 * Descobre os FORMATOS reais das células, para calibrar os normalizadores.
 *
 * PRIVACIDADE: campos sensíveis (nome de parte, placa, apólice, sinistro,
 * valores financeiros) nunca têm o conteúdo impresso — apenas o *formato*
 * (tipo da célula, padrão do texto). Colunas de enumeração (Status, Risco,
 * Fase, Resultado) têm os valores distintos exibidos porque são vocabulário
 * controlado do negócio, não dado pessoal.
 *
 * Uso: node --experimental-strip-types scripts/perfilar-valores.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import {
  resolverCabecalho,
  type CampoLogico,
} from '../lib/ingestao/mapeamento-colunas.ts'

const DIR = path.join(process.cwd(), 'dados-reais')

/** Vocabulário controlado do negócio — seguro exibir. */
const ENUMERACOES: CampoLogico[] = [
  'status',
  'risco',
  'fase',
  'resultado_sentenca',
  'polo_cliente',
  'area',
  'materia',
  'mga_polo_passivo',
  'tipo_encerramento',
]

/** Campos onde só o FORMATO pode ser mostrado, nunca o conteúdo. */
const SENSIVEIS: CampoLogico[] = [
  'data_cadastro',
  'data_ajuizamento',
  'data_encerramento',
  'data_condenacao',
  'valor_causa',
  'valor_acordo',
  'valor_condenacao',
  'valor_provisionado',
  'exito_processo',
]

/** Descreve o formato de um valor sem revelar o conteúdo. */
function formatoDe(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(vazio)'
  if (v instanceof Date) return 'Date do Excel'
  if (typeof v === 'number') return 'número'
  if (typeof v === 'boolean') return 'booleano'
  const s = String(v).trim()
  if (s === '') return '(só espaços)'
  if (/^N\/?A$/i.test(s)) return 'texto "N/A"'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return 'texto DD/MM/AAAA'
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return 'texto AAAA-MM-DD'
  if (/^-?[\d.]+,\d{2}$/.test(s)) return 'texto número pt-BR (1.234,56)'
  if (/^-?[\d,]+\.\d{2}$/.test(s)) return 'texto número en-US (1,234.56)'
  if (/^R\$/.test(s)) return 'texto com R$'
  if (/^-?\d+([.,]\d+)?$/.test(s)) return 'texto numérico simples'
  if (/^0[.,]?0*\s*[-(]/.test(s)) return 'texto começando com zero + explicação'
  if (/^\d/.test(s)) return 'texto começando com dígito'
  return 'texto livre'
}

interface Perfil {
  formatos: Map<string, number>
  valores: Map<string, number> // só para enumerações
}

function perfilar(arquivo: string) {
  console.log('\n' + '='.repeat(76))
  console.log(arquivo)
  console.log('='.repeat(76))

  const wb = XLSX.read(fs.readFileSync(path.join(DIR, arquivo)), {
    type: 'buffer',
    cellDates: true,
    cellFormula: false,
    cellHTML: false,
  })

  const perfis = new Map<CampoLogico, Perfil>()

  for (const nomeAba of wb.SheetNames) {
    if (nomeAba === 'GERAL') continue // não é importada; duplica as demais
    const ws = wb.Sheets[nomeAba]
    if (!ws['!ref']) continue
    const range = XLSX.utils.decode_range(ws['!ref'])

    // Cabeçalho na linha 2 (índice +1): faixa de título ocupa a linha 1.
    const linhaCab = range.s.r + 1
    const nomes: string[] = []
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cel = ws[XLSX.utils.encode_cell({ r: linhaCab, c })]
      nomes.push(cel ? String(cel.v ?? '').trim() : '')
    }
    const { mapeadas } = resolverCabecalho(nomes)

    for (const [campo, idx] of mapeadas) {
      const interessa = ENUMERACOES.includes(campo) || SENSIVEIS.includes(campo)
      if (!interessa) continue

      let p = perfis.get(campo)
      if (!p) {
        p = { formatos: new Map(), valores: new Map() }
        perfis.set(campo, p)
      }

      for (let r = linhaCab + 1; r <= range.e.r; r++) {
        const cel = ws[XLSX.utils.encode_cell({ r, c: range.s.c + idx })]
        const v = cel ? cel.v : undefined
        const f = formatoDe(v)
        p.formatos.set(f, (p.formatos.get(f) ?? 0) + 1)

        if (ENUMERACOES.includes(campo) && v !== undefined && v !== null) {
          const bruto = String(v)
          p.valores.set(bruto, (p.valores.get(bruto) ?? 0) + 1)
        }
      }
    }
  }

  for (const campo of [...ENUMERACOES, ...SENSIVEIS]) {
    const p = perfis.get(campo)
    if (!p) continue
    console.log(`\n  ${campo}`)
    const fs_ = [...p.formatos.entries()].sort((a, b) => b[1] - a[1])
    for (const [f, n] of fs_) console.log(`     ${String(n).padStart(5)}x  ${f}`)

    if (ENUMERACOES.includes(campo) && p.valores.size <= 40) {
      const vs = [...p.valores.entries()].sort((a, b) => b[1] - a[1])
      console.log(`     valores distintos (${p.valores.size}):`)
      for (const [v, n] of vs) console.log(`        ${String(n).padStart(4)}x ${JSON.stringify(v)}`)
    } else if (ENUMERACOES.includes(campo)) {
      console.log(`     valores distintos: ${p.valores.size} (muitos para listar)`)
    }
  }
}

const arquivos = fs
  .readdirSync(DIR)
  .filter(f => f.toLowerCase().endsWith('.xlsx') && f.includes('JULHO'))
for (const a of arquivos) perfilar(a)
