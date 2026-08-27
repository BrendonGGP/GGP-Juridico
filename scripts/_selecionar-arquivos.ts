/**
 * Escolha EXPLÍCITA de qual planilha usar em dados-reais/.
 *
 * Existe porque a pasta acumula versões: dois Relatórios Gerais de julho (um
 * deles uma exportação parcial), duas planilhas de Acordos de meses diferentes.
 * Um script que escolhe por `includes('ACORDOS')` pega qualquer uma e produz
 * um número errado sem avisar.
 *
 * Aqui a regra é: filtra por tipo e mês, e ABORTA se sobrar mais de um
 * candidato. Ambiguidade vira erro, não escolha silenciosa.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

export const DIR_DADOS = path.join(process.cwd(), 'dados-reais')

const MESES: Record<string, string> = {
  JANEIRO: '01', FEVEREIRO: '02', MARCO: '03', ABRIL: '04',
  MAIO: '05', JUNHO: '06', JULHO: '07', AGOSTO: '08',
  SETEMBRO: '09', OUTUBRO: '10', NOVEMBRO: '11', DEZEMBRO: '12',
}

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

/** Mês do nome do arquivo, no formato "AAAA-MM". null se não der para inferir. */
function mesDoNome(nome: string): string | null {
  const n = semAcento(nome)
  for (const [rotulo, mm] of Object.entries(MESES)) {
    const re = new RegExp(`${rotulo}[-/ ]?(\\d{4})`)
    const m = re.exec(n)
    if (m) return `${m[1]}-${mm}`
  }
  return null
}

export type TipoPlanilha = 'GERAL' | 'ACORDOS'

function tipoDoNome(nome: string): TipoPlanilha {
  return semAcento(nome).includes('ACORDO') ? 'ACORDOS' : 'GERAL'
}

export interface ArquivoSelecionado {
  nome: string
  caminho: string
  mes: string | null
}

/**
 * Seleciona a planilha do tipo e mês pedidos.
 *
 * @throws quando não há candidato, ou quando há mais de um — nesse caso a
 *         mensagem lista os arquivos, para a pessoa decidir qual remover.
 */
export function selecionar(tipo: TipoPlanilha, mes: string): ArquivoSelecionado {
  const todos = fs
    .readdirSync(DIR_DADOS)
    .filter(f => f.toLowerCase().endsWith('.xlsx'))
    .map(nome => ({ nome, caminho: path.join(DIR_DADOS, nome), mes: mesDoNome(nome) }))

  const candidatos = todos.filter(a => tipoDoNome(a.nome) === tipo && a.mes === mes)

  if (candidatos.length === 0) {
    const doTipo = todos.filter(a => tipoDoNome(a.nome) === tipo)
    throw new Error(
      `Nenhuma planilha de ${tipo} para ${mes} em dados-reais/.\n` +
        `Encontradas do tipo ${tipo}: ${doTipo.map(a => `${a.nome} (${a.mes ?? 'mês não identificado'})`).join(', ') || 'nenhuma'}`
    )
  }

  if (candidatos.length > 1) {
    throw new Error(
      `AMBÍGUO: ${candidatos.length} planilhas de ${tipo} para ${mes}:\n` +
        candidatos.map(a => `  - ${a.nome}`).join('\n') +
        '\nRemova as versões antigas antes de continuar.'
    )
  }

  return candidatos[0]
}

/** Lê e já informa qual arquivo foi usado — para o relatório nunca ser anônimo. */
export function carregar(tipo: TipoPlanilha, mes: string): { arquivo: ArquivoSelecionado; conteudo: Buffer } {
  const arquivo = selecionar(tipo, mes)
  return { arquivo, conteudo: fs.readFileSync(arquivo.caminho) }
}
