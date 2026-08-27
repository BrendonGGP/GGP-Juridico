/**
 * Provisionamento de risco por cenário.
 *
 * A matriz vem da especificação validada com o Jurídico (seção 3.1). Ela é a
 * regra de negócio inteira deste módulo — errar um percentual aqui muda o
 * passivo declarado do grupo.
 *
 * Frase-guia do material de referência: "Risco precisa ter preço e
 * previsibilidade."
 */

export type Cenario = 'CONSERVADOR' | 'REALISTA' | 'OTIMISTA'
export type Risco = 'PROVAVEL' | 'POSSIVEL' | 'REMOTO'

/**
 * Percentual do valor provisionado que cada cenário reconhece, por risco.
 *
 * Conservador  Provável 100% · Possível 100% · Remoto 25%
 * Realista     Provável 100% · Possível  50% · Remoto  0%
 * Otimista     Provável  50% · Possível   0% · Remoto  0%
 */
export const MATRIZ_CENARIOS: Readonly<Record<Cenario, Readonly<Record<Risco, number>>>> = {
  CONSERVADOR: { PROVAVEL: 1.0, POSSIVEL: 1.0, REMOTO: 0.25 },
  REALISTA: { PROVAVEL: 1.0, POSSIVEL: 0.5, REMOTO: 0.0 },
  OTIMISTA: { PROVAVEL: 0.5, POSSIVEL: 0.0, REMOTO: 0.0 },
}

export const CENARIOS: Cenario[] = ['CONSERVADOR', 'REALISTA', 'OTIMISTA']

export const ROTULO_CENARIO: Record<Cenario, string> = {
  CONSERVADOR: 'Conservador',
  REALISTA: 'Realista',
  OTIMISTA: 'Otimista',
}

/** O que o cálculo precisa saber de cada processo. */
export interface ProcessoParaProvisionar {
  risco: Risco | null
  valorProvisionado: number | null
  /** Processo encerrado não carrega mais risco em aberto. */
  encerrado: boolean
}

export interface GrupoRisco {
  risco: Risco
  /** Quantidade de processos neste risco. */
  casos: number
  /** Soma do Valor Provisionado, sem aplicar o percentual do cenário. */
  valorBruto: number
  percentualAplicado: number
  /** valorBruto × percentualAplicado. É o que entra no passivo do cenário. */
  valorProvisionado: number
}

export interface ResultadoProvisionamento {
  cenario: Cenario
  grupos: GrupoRisco[]
  totalCasos: number
  totalBruto: number
  totalProvisionado: number
  /**
   * Processos deixados de fora do cálculo, com o motivo. Nunca são somados
   * como zero em silêncio — um passivo menor por falta de dado é pior que um
   * passivo com ressalva declarada.
   */
  excluidos: {
    encerrados: number
    semRisco: number
    semValor: number
  }
}

const RISCOS: Risco[] = ['PROVAVEL', 'POSSIVEL', 'REMOTO']

/**
 * Calcula o provisionamento de um conjunto de processos num cenário.
 *
 * A base é o campo `Valor Provisionado` da planilha — valor curado pelo
 * Jurídico, não derivado. O cenário apenas pondera esse valor pelo risco.
 */
export function calcularProvisionamento(
  processos: ProcessoParaProvisionar[],
  cenario: Cenario
): ResultadoProvisionamento {
  const pesos = MATRIZ_CENARIOS[cenario]

  const acumulado = new Map<Risco, { casos: number; valorBruto: number }>(
    RISCOS.map(r => [r, { casos: 0, valorBruto: 0 }])
  )

  const excluidos = { encerrados: 0, semRisco: 0, semValor: 0 }

  for (const p of processos) {
    // Processo encerrado não tem risco em aberto para provisionar.
    if (p.encerrado) {
      excluidos.encerrados++
      continue
    }
    // Risco ausente NUNCA vira um padrão. Um default de REMOTO faria o passivo
    // aparecer menor do que é.
    if (p.risco === null) {
      excluidos.semRisco++
      continue
    }
    if (p.valorProvisionado === null) {
      excluidos.semValor++
      continue
    }

    const g = acumulado.get(p.risco)!
    g.casos++
    g.valorBruto += p.valorProvisionado
  }

  const grupos: GrupoRisco[] = RISCOS.map(risco => {
    const g = acumulado.get(risco)!
    const percentualAplicado = pesos[risco]
    return {
      risco,
      casos: g.casos,
      valorBruto: g.valorBruto,
      percentualAplicado,
      valorProvisionado: g.valorBruto * percentualAplicado,
    }
  })

  return {
    cenario,
    grupos,
    totalCasos: grupos.reduce((s, g) => s + g.casos, 0),
    totalBruto: grupos.reduce((s, g) => s + g.valorBruto, 0),
    totalProvisionado: grupos.reduce((s, g) => s + g.valorProvisionado, 0),
    excluidos,
  }
}

/** Os três cenários de uma vez, para a comparação lado a lado do Dashboard. */
export function calcularTodosCenarios(
  processos: ProcessoParaProvisionar[]
): Record<Cenario, ResultadoProvisionamento> {
  return {
    CONSERVADOR: calcularProvisionamento(processos, 'CONSERVADOR'),
    REALISTA: calcularProvisionamento(processos, 'REALISTA'),
    OTIMISTA: calcularProvisionamento(processos, 'OTIMISTA'),
  }
}
