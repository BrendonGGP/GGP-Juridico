import { describe, it, expect } from 'vitest'
import {
  resolverColuna,
  resolverCabecalho,
  normalizarNomeColuna,
} from '@/lib/ingestao/mapeamento-colunas'

describe('REGRA 3 — resolver coluna por apelido, nunca por nome fixo', () => {
  it('reconhece a grafia de JULHO e a de JUNHO como o mesmo campo', () => {
    // O achado mais crítico: os nomes mudaram entre os dois meses.
    expect(resolverColuna('Resultado (Sentença)')).toBe('resultado_sentenca')
    expect(resolverColuna('Resultado (Tipo de Sentença)')).toBe('resultado_sentenca')

    expect(resolverColuna('Valor total da condenação')).toBe('valor_condenacao')
    expect(resolverColuna('Valor do resultado (Condenação)')).toBe('valor_condenacao')

    expect(resolverColuna('Placa do Veículo - GGP')).toBe('placa_veiculo')
    expect(resolverColuna('Placa do Veículo')).toBe('placa_veiculo')

    expect(resolverColuna('Nº Sinistro')).toBe('numero_sinistro')
    expect(resolverColuna('Nº do Sinistro')).toBe('numero_sinistro')

    expect(resolverColuna('Motivo do Sinistro GGP')).toBe('motivo_sinistro')
    expect(resolverColuna('Motivo da Negativa do Sinistro')).toBe('motivo_sinistro')

    expect(resolverColuna('M.G.A está no polo passivo (Sim ou Não)')).toBe('mga_polo_passivo')
    expect(resolverColuna('MGA ESTÁ NO POLO PASSIVO')).toBe('mga_polo_passivo')
  })

  it('tolera acento, caixa e espaço sobrando — sem confundir com renomeação', () => {
    expect(resolverColuna('  valor da CAUSA  ')).toBe('valor_causa')
    expect(resolverColuna('Area')).toBe('area')
    expect(resolverColuna('Área')).toBe('area')
    expect(resolverColuna('EXITO DO PROCESSO')).toBe('exito_processo')
  })

  it('absorve o espaço não-quebrável que o Excel injeta', () => {
    // Construido por codigo: um nbsp literal no fonte e invisivel na revisao
    // e some se um editor normalizar o arquivo — o teste passaria sem testar nada.
    const NBSP = '\u00a0'
    expect(resolverColuna(`Valor${NBSP}da${NBSP}causa`)).toBe('valor_causa')
    expect(resolverColuna(`Ficha${NBSP}`)).toBe('ficha')
  })

  it('mantém Area e Tipo de Ação como campos DISTINTOS (REGRA 7)', () => {
    // O filtro de Trabalhista usa Area. Se os dois colidissem, casos marcados
    // como Area=Trabalhista com Tipo de Ação="Mandado de Segurança" sumiriam.
    expect(resolverColuna('Area')).toBe('area')
    expect(resolverColuna('Tipo de Ação')).toBe('tipo_acao')
    expect(resolverColuna('Area')).not.toBe(resolverColuna('Tipo de Ação'))
  })

  it('devolve null para coluna desconhecida — nunca adivinha', () => {
    expect(resolverColuna('Coluna Que Nunca Existiu')).toBeNull()
    expect(resolverColuna('Observações Internas do Escritório')).toBeNull()
  })

  it('reconhece coluna que existia em junho e sumiu em julho', () => {
    // "Modelo/Cor do Veículo" foi removida em julho/2026. Continua mapeada para
    // que reimportar um mês antigo não gere pendência falsa.
    expect(resolverColuna('Modelo/Cor do Veículo')).toBe('modelo_cor_veiculo')
  })

  it('reconhece as TRÊS grafias reais de valor da condenação', () => {
    // Encontradas nos arquivos reais: duas no Relatório Geral (jun e jul) e uma
    // terceira, diferente das duas, na planilha de Acordos.
    expect(resolverColuna('Valor do resultado (Condenação)')).toBe('valor_condenacao')
    expect(resolverColuna('Valor total da condenação')).toBe('valor_condenacao')
    expect(resolverColuna('Valor do resultado (Valor da Condenação)')).toBe('valor_condenacao')
  })
})

describe('resolverCabecalho', () => {
  it('mapeia o cabeçalho e separa o que não reconheceu', () => {
    const r = resolverCabecalho([
      'Nº',
      'Ficha',
      'Tipo de Ação',
      'Area',
      'Valor da causa',
      'Campo Novo Inesperado',
    ])

    expect(r.mapeadas.get('numero_ordem')).toBe(0)
    expect(r.mapeadas.get('ficha')).toBe(1)
    expect(r.mapeadas.get('tipo_acao')).toBe(2)
    expect(r.mapeadas.get('area')).toBe(3)
    expect(r.mapeadas.get('valor_causa')).toBe(4)

    expect(r.naoReconhecidas).toEqual([{ nome: 'Campo Novo Inesperado', indice: 5 }])
  })

  it('REGRA 10 — coluna desconhecida vira pendência, NÃO lança exceção', () => {
    expect(() =>
      resolverCabecalho(['???', 'lixo', 'Valor da causa'])
    ).not.toThrow()

    const r = resolverCabecalho(['???', 'lixo', 'Valor da causa'])
    expect(r.naoReconhecidas).toHaveLength(2)
    // O que era válido continua sendo aproveitado.
    expect(r.mapeadas.get('valor_causa')).toBe(2)
  })

  it('reporta duas colunas que resolvem para o mesmo campo', () => {
    // Cenário real: a planilha traz a grafia velha E a nova no mesmo arquivo.
    const r = resolverCabecalho([
      'Resultado (Sentença)',
      'Resultado (Tipo de Sentença)',
    ])
    expect(r.duplicadas).toEqual([
      {
        campo: 'resultado_sentenca',
        nomes: ['Resultado (Sentença)', 'Resultado (Tipo de Sentença)'],
      },
    ])
    // A primeira vence, de forma determinística.
    expect(r.mapeadas.get('resultado_sentenca')).toBe(0)
  })

  it('ignora colunas sem cabeçalho sem contá-las como pendência', () => {
    const r = resolverCabecalho(['Ficha', '', '   ', 'UF'])
    expect(r.naoReconhecidas).toHaveLength(0)
    expect(r.mapeadas.size).toBe(2)
  })

  it('lida com o schema reduzido da aba BAIXADOS', () => {
    const r = resolverCabecalho([
      'Nº', 'Ficha', 'Data do cadastro', 'Tipo de Ação', 'Area', 'Cliente',
      'Autor', 'Réu', 'Número do processo', 'Comarca', 'UF', 'Valor da causa',
      'Descrição Sumária', 'Data do encerramento', 'Tipo Encerramento', 'Status',
    ])
    expect(r.naoReconhecidas).toHaveLength(0)
    expect(r.mapeadas.get('data_encerramento')).toBe(13)
    expect(r.mapeadas.get('tipo_encerramento')).toBe(14)
    // BAIXADOS não traz Risco nem Valor Provisionado — e isso é esperado.
    expect(r.mapeadas.has('risco')).toBe(false)
    expect(r.mapeadas.has('valor_provisionado')).toBe(false)
  })
})

describe('normalizarNomeColuna', () => {
  it('remove acento, caixa, espaço extra e pontuação final', () => {
    expect(normalizarNomeColuna('  Réu ')).toBe('reu')
    expect(normalizarNomeColuna('Descrição   Sumária')).toBe('descricao sumaria')
    expect(normalizarNomeColuna('Status:')).toBe('status')
  })

  it('preserva o "º" — é indicador ordinal, não acento', () => {
    // Se o NFD removesse o º, "Nº Sinistro" viraria "n sinistro" e deixaria
    // de casar com o apelido cadastrado.
    expect(normalizarNomeColuna('Nº  Sinistro')).toBe('nº sinistro')
  })
})
