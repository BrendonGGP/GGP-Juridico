/**
 * Confere se as chaves do Supabase foram preenchidas corretamente.
 *
 * NUNCA imprime o valor de uma chave — só o nome, o tamanho e um veredito.
 * Uma chave num log é uma chave que precisa ser trocada, e saída de terminal
 * costuma ir mais longe do que se espera (print, cópia para mensagem, histórico
 * do shell).
 *
 * Uso: node --experimental-strip-types scripts/verificar-chaves.ts
 */
import 'dotenv/config'

interface Checagem {
  nome: string
  obrigatoria: boolean
  descricao: string
  valida?: (v: string) => string | null
}

const CHECAGENS: Checagem[] = [
  {
    nome: 'NEXT_PUBLIC_SUPABASE_URL',
    obrigatoria: true,
    descricao: 'Project URL',
    valida: v => {
      if (!v.startsWith('https://')) return 'deveria começar com https://'
      if (!v.includes('.supabase.co')) return 'não parece uma URL do Supabase'
      if (v.endsWith('/')) return 'remova a barra do final'
      return null
    },
  },
  {
    nome: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    obrigatoria: true,
    descricao: 'chave anon public',
    valida: v => (v.length < 40 ? 'curta demais — parece incompleta' : null),
  },
  {
    nome: 'SUPABASE_SERVICE_ROLE_KEY',
    obrigatoria: false,
    descricao: 'chave service_role (necessária para convidar usuários)',
    valida: v => (v.length < 40 ? 'curta demais — parece incompleta' : null),
  },
]

let problemas = 0

console.log('Chaves do Supabase\n')

for (const c of CHECAGENS) {
  const bruto = process.env[c.nome]
  const valor = bruto?.trim()

  if (!valor) {
    const rotulo = c.obrigatoria ? 'FALTA  ' : 'ausente'
    console.log(`${rotulo}  ${c.nome}`)
    console.log(`         ${c.descricao}`)
    if (c.obrigatoria) problemas++
    continue
  }

  // Aspas e espaços são o erro de colagem mais comum.
  if (bruto !== valor) {
    console.log(`ERRO     ${c.nome} — tem espaço no início ou no fim`)
    problemas++
    continue
  }
  if (/^["']|["']$/.test(valor)) {
    console.log(`ERRO     ${c.nome} — remova as aspas`)
    problemas++
    continue
  }

  const erro = c.valida?.(valor)
  if (erro) {
    console.log(`ERRO     ${c.nome} — ${erro}`)
    problemas++
    continue
  }

  // Só o tamanho. O valor nunca é impresso.
  console.log(`ok       ${c.nome} (${valor.length} caracteres)`)
}

console.log()

if (problemas === 0) {
  console.log('Tudo certo. Reinicie o servidor se ainda não reiniciou.')
} else {
  console.log(`${problemas} problema(s). Veja PASSO-1-CHAVES-SUPABASE.md.`)
}

process.exit(problemas === 0 ? 0 : 1)
