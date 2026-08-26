/**
 * REGRA 3 do CLAUDE.md — nunca ler coluna por nome fixo.
 *
 * Comparando a planilha de junho/2026 com a de julho/2026, praticamente todo
 * nome de coluna relevante mudou. Um parser que procura "Resultado (Sentença)"
 * quebra silenciosamente no mês em que o escritório renomear para outra coisa.
 *
 * A solução é resolver por CAMPO LÓGICO: cada campo reconhece vários apelidos
 * conhecidos. Coluna que não bate com nenhum apelido NÃO é ignorada — vira
 * pendência na tela de validação, para alguém decidir se é campo novo ou
 * grafia nova de um campo existente.
 *
 * ATENÇÃO: esta tabela foi montada a partir da especificação, que documenta
 * junho e julho/2026. Precisa ser CALIBRADA contra as planilhas reais antes da
 * primeira importação de produção.
 */

export type CampoLogico =
  // Identificação
  | 'numero_ordem'
  | 'pj'
  | 'ficha'
  | 'numero_processo'
  // Datas
  | 'data_cadastro'
  | 'data_ajuizamento'
  | 'data_citacao'
  | 'data_encerramento'
  | 'tipo_encerramento'
  // Classificação
  | 'tipo_acao'
  | 'materia'
  | 'area'
  | 'fase'
  | 'produto'
  | 'competencia'
  | 'civel'
  // Partes
  | 'todos_envolvidos'
  | 'cliente'
  | 'autor'
  | 'reu'
  | 'comarca'
  | 'uf'
  | 'polo_cliente'
  // Risco e provisionamento
  | 'risco'
  | 'valor_provisionado'
  | 'justificativa_provisionamento'
  // Valores
  | 'valor_causa'
  | 'data_valor_estimado'
  | 'valor_condenacao'
  | 'data_condenacao'
  | 'data_atualizacao_condenacao'
  | 'valor_acordo'
  | 'termos_acordo'
  | 'exito_processo'
  | 'justificativa_exito'
  // Resultado
  | 'resultado_sentenca'
  | 'observacao_resultado'
  | 'acordao'
  // Seguro / sinistro
  | 'placa_veiculo'
  | 'modelo_cor_veiculo'
  | 'oficina'
  | 'data_sinistro'
  | 'numero_sinistro'
  | 'motivo_sinistro'
  | 'numero_apolice'
  | 'mga'
  | 'mga_polo_passivo'
  | 'decorrente_de_sinistro'
  // Operacional
  | 'descricao_sumaria'
  | 'situacao_atual'
  | 'proximos_passos'
  | 'status'
  | 'cdas'

/**
 * Apelidos conhecidos por campo lógico.
 *
 * Onde há duas grafias marcadas jun/jul, ambas foram observadas em planilhas
 * reais — a mudança de nome entre meses é o achado mais crítico do projeto.
 */
export const APELIDOS: Record<CampoLogico, string[]> = {
  numero_ordem: ['Nº', 'N°', 'No', 'Numero', 'Número'],
  pj: ['PJ'],
  ficha: ['Ficha'],
  numero_processo: ['Número do processo', 'Numero do processo', 'Nº do processo'],

  data_cadastro: ['Data do cadastro', 'Data de cadastro'],
  data_ajuizamento: ['Data Ajuizamento', 'Data de Ajuizamento', 'Data de Distribuição'],
  data_citacao: ['Citação', 'Citacao', 'Data da Citação'],
  data_encerramento: ['Data do encerramento', 'Data de encerramento'],
  tipo_encerramento: ['Tipo Encerramento', 'Tipo de Encerramento'],

  tipo_acao: ['Tipo de Ação', 'Tipo de Acao', 'Tipo Ação'],
  materia: ['Matéria', 'Materia'],
  area: ['Area', 'Área'],
  fase: ['Fase'],
  produto: ['Produto'],
  competencia: ['Competência', 'Competencia'],
  /// Só existe na planilha de Acordos.
  civel: ['Civel', 'Cível'],

  todos_envolvidos: ['Todos envolvidos', 'Todos os envolvidos'],
  cliente: ['Cliente'],
  autor: ['Autor'],
  reu: ['Réu', 'Reu'],
  comarca: ['Comarca'],
  uf: ['UF'],
  polo_cliente: ['Polo do cliente', 'Pólo do cliente'],

  risco: ['Risco'],
  valor_provisionado: ['Valor Provisionado', 'Valor provisionado'],
  justificativa_provisionamento: [
    'Justificativa do provisionamento',
    'Justificativa provisionamento',
  ],

  valor_causa: ['Valor da causa', 'Valor da Causa'],
  data_valor_estimado: ['Data do valor estimado'],

  // jun: "Valor do resultado (Condenação)"  ->  jul: "Valor total da condenação"
  /// TRÊS grafias observadas em arquivos reais:
  ///   jun/2026 (Relatório Geral): "Valor do resultado (Condenação)"
  ///   jul/2026 (Relatório Geral): "Valor total da condenação"
  ///   Acordos:                    "Valor do resultado (Valor da Condenação)"
  valor_condenacao: [
    'Valor total da condenação',
    'Valor do resultado (Condenação)',
    'Valor do resultado (Valor da Condenação)',
    'Valor da condenação',
  ],
  data_condenacao: ['Data da Condenação', 'Data da Condenacao'],
  data_atualizacao_condenacao: ['Data da atualização da condenação'],

  valor_acordo: ['Valor do Acordo', 'Valor do acordo'],
  termos_acordo: ['Termos do Acordo', 'Termos do acordo'],
  exito_processo: ['Êxito do processo', 'Exito do processo'],
  justificativa_exito: ['Justificativa do Êxito', 'Justificativa do Exito'],

  // jun: "Resultado (Tipo de Sentença)"  ->  jul: "Resultado (Sentença)"
  resultado_sentenca: [
    'Resultado (Sentença)',
    'Resultado (Tipo de Sentença)',
    'Resultado',
  ],
  observacao_resultado: [
    'Observação do resultado (Dispositivo da Sentença)',
    'Observação do resultado',
  ],
  acordao: ['Acórdão', 'Acordao'],

  // jun: "Placa do Veículo"  ->  jul: "Placa do Veículo - GGP"
  placa_veiculo: ['Placa do Veículo - GGP', 'Placa do Veículo', 'Placa'],
  /// Existia em junho/2026 e foi REMOVIDA em julho. Mantida no mapeamento para
  /// que planilhas antigas continuem legíveis sem gerar pendência falsa.
  modelo_cor_veiculo: ['Modelo/Cor do Veículo', 'Modelo/Cor do Veiculo'],
  oficina: ['Oficina'],
  data_sinistro: ['Data do Sinistro', 'Data do sinistro'],
  // jun: "Nº do Sinistro"  ->  jul: "Nº Sinistro"
  numero_sinistro: ['Nº Sinistro', 'Nº do Sinistro', 'Numero do Sinistro'],
  // jun: "Motivo da Negativa do Sinistro"  ->  jul: "Motivo do Sinistro GGP"
  motivo_sinistro: [
    'Motivo do Sinistro GGP',
    'Motivo da Negativa do Sinistro',
    'Motivo do Sinistro',
  ],
  numero_apolice: ['Nº da apólice', 'Nº da apolice', 'Numero da apólice'],
  mga: ['M.G.A', 'MGA', 'M.G.A.'],
  // jun: "MGA ESTÁ NO POLO PASSIVO"  ->  jul: "M.G.A está no polo passivo (Sim ou Não)"
  mga_polo_passivo: [
    'M.G.A está no polo passivo (Sim ou Não)',
    'MGA ESTÁ NO POLO PASSIVO',
    'M.G.A está no polo passivo',
  ],
  decorrente_de_sinistro: ['São decorrentes de sinistros?', 'São decorrentes de sinistro?'],

  descricao_sumaria: ['Descrição Sumária', 'Descricao Sumaria'],
  situacao_atual: ['Situação atual do processo', 'Situacao atual do processo'],
  proximos_passos: ['Próximos passos', 'Proximos passos'],
  status: ['Status'],
  cdas: ['CDAS'],
}

/**
 * Normaliza um nome de coluna para comparação tolerante.
 *
 * Absorve as variações que NÃO mudam o significado — acento, caixa, espaço
 * sobrando (a planilha real tem "ATIVO " com espaço à direita), espaço duplo,
 * espaço sem quebra vindo do Excel, e pontuação final.
 *
 * NÃO absorve renomeação de verdade: isso é papel da tabela de apelidos.
 */
export function normalizarNomeColuna(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // marcas de acento, apos decompor com NFD
    .replace(/[\u00a0\u2007\u202f]/g, ' ') // espacos nao-quebraveis do Excel
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.:;]+$/, '')
    .toLowerCase()
}

/** Índice invertido apelido-normalizado -> campo lógico, montado uma vez. */
const INDICE: ReadonlyMap<string, CampoLogico> = (() => {
  const m = new Map<string, CampoLogico>()
  for (const [campo, apelidos] of Object.entries(APELIDOS) as [
    CampoLogico,
    string[],
  ][]) {
    for (const apelido of apelidos) {
      const chave = normalizarNomeColuna(apelido)
      const existente = m.get(chave)
      if (existente && existente !== campo) {
        throw new Error(
          `Apelido ambíguo "${apelido}": mapeia para "${existente}" e "${campo}".`
        )
      }
      m.set(chave, campo)
    }
  }
  return m
})()

/** Resolve um nome de coluna para o campo lógico, ou null se desconhecido. */
export function resolverColuna(nome: string): CampoLogico | null {
  return INDICE.get(normalizarNomeColuna(nome)) ?? null
}

export interface ResultadoCabecalho {
  /** campo lógico -> índice da coluna na planilha */
  mapeadas: Map<CampoLogico, number>
  /** Colunas que nenhum apelido reconheceu. Viram pendência de validação. */
  naoReconhecidas: { nome: string; indice: number }[]
  /** Duas colunas diferentes resolveram para o mesmo campo lógico. */
  duplicadas: { campo: CampoLogico; nomes: string[] }[]
}

/**
 * Resolve a linha de cabeçalho inteira.
 *
 * Nunca lança por coluna desconhecida — devolve em `naoReconhecidas` para a
 * tela de validação. Falhar aqui travaria o lote inteiro, violando a REGRA 10.
 */
export function resolverCabecalho(nomes: string[]): ResultadoCabecalho {
  const mapeadas = new Map<CampoLogico, number>()
  const naoReconhecidas: { nome: string; indice: number }[] = []
  const vistos = new Map<CampoLogico, string[]>()

  nomes.forEach((nome, indice) => {
    if (!nome || !nome.trim()) return // coluna sem cabeçalho: ignorada em silêncio
    const campo = resolverColuna(nome)
    if (campo === null) {
      naoReconhecidas.push({ nome, indice })
      return
    }
    const jaVistos = vistos.get(campo) ?? []
    jaVistos.push(nome)
    vistos.set(campo, jaVistos)
    // A primeira ocorrência vence; a segunda é reportada como duplicada.
    if (!mapeadas.has(campo)) mapeadas.set(campo, indice)
  })

  const duplicadas = [...vistos.entries()]
    .filter(([, nomes]) => nomes.length > 1)
    .map(([campo, nomes]) => ({ campo, nomes }))

  return { mapeadas, naoReconhecidas, duplicadas }
}
