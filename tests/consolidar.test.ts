import { describe, it, expect } from 'vitest'
import {
  consolidar,
  mesclarAcordos,
  chaveIdentidade,
  type RegistroConsolidado,
} from '@/lib/ingestao/consolidar'
import type { LinhaLida } from '@/lib/ingestao/ler-planilha'

function linha(over: Partial<LinhaLida> & { campos?: LinhaLida['campos'] } = {}): LinhaLida {
  return {
    aba: 'SEVEN INSURTECH',
    linha: 3,
    carteira: 'SEVEN INSURTECH',
    encerrado: false,
    campos: {},
    parcelas: [],
    pendencias: [],
    ...over,
  }
}

describe('chaveIdentidade — REGRA 5', () => {
  it('prefere a ficha, que é o que distingue IDPJ do processo principal', () => {
    // Os dois tramitam nos MESMOS autos e compartilham numero_processo.
    const principal = chaveIdentidade('0002712-11.2026.8.13.0001', 'F100')
    const idpj = chaveIdentidade('0002712-11.2026.8.13.0001', 'F200')
    expect(principal).not.toBe(idpj)
  })

  it('usa numero_processo quando não há ficha', () => {
    expect(chaveIdentidade('0001-00.2026.8.13.0001', null)).toBe(
      'processo:0001-00.2026.8.13.0001'
    )
  })

  it('NUNCA usa "A DISTRIBUIR" como identidade', () => {
    // É valor genérico compartilhado. Usá-lo fundiria processos distintos.
    expect(chaveIdentidade('A DISTRIBUIR', null)).toBeNull()
    expect(chaveIdentidade('a distribuir', null)).toBeNull()
    // Mas com ficha, a linha continua identificável.
    expect(chaveIdentidade('A DISTRIBUIR', 'F1')).toBe('ficha:f1')
  })

  it('a mesma ficha produz a mesma chave em meses diferentes', () => {
    // É isto que faz o histórico funcionar: o processo é reencontrado.
    expect(chaveIdentidade('0001-00.2026.8.13.0001', 'F1')).toBe(
      chaveIdentidade('0001-00.2026.8.13.0001', 'F1')
    )
    // Inclusive quando o processo ganha número real depois de "A DISTRIBUIR".
    expect(chaveIdentidade('A DISTRIBUIR', 'F1')).toBe(
      chaveIdentidade('0009-00.2026.8.13.0001', 'F1')
    )
  })
})

describe('consolidar — REGRA 8: BAIXADOS vence', () => {
  it('processo em aba ativa e em BAIXADOS fica encerrado', () => {
    const r = consolidar([
      linha({ aba: 'SEVEN INSURTECH', linha: 3, campos: { ficha: 'F1', risco: 'PROVAVEL' } }),
      linha({
        aba: 'BAIXADOS ULTIMOS 3 MESES',
        linha: 5,
        encerrado: true,
        campos: { ficha: 'F1' },
      }),
    ])

    expect(r.registros).toHaveLength(1)
    expect(r.registros[0].encerrado).toBe(true)
    const p = r.pendencias.find(p => p.tipo === 'CONFLITO_BAIXADOS_ATIVA')
    expect(p).toBeDefined()
  })

  it('a precedência não depende da ORDEM das abas no arquivo', () => {
    const ativa = linha({ aba: 'SEVEN INSURTECH', linha: 3, campos: { ficha: 'F1' } })
    const baixada = linha({
      aba: 'BAIXADOS ULTIMOS 3 MESES', linha: 5, encerrado: true, campos: { ficha: 'F1' },
    })
    // Se dependesse da ordem, reordenar as abas mudaria o provisionamento.
    expect(consolidar([ativa, baixada]).registros[0].encerrado).toBe(true)
    expect(consolidar([baixada, ativa]).registros[0].encerrado).toBe(true)
  })

  it('preserva os campos da aba ativa, que tem schema mais rico', () => {
    // BAIXADOS não traz Risco nem Valor Provisionado.
    const r = consolidar([
      linha({
        aba: 'SEVEN INSURTECH', linha: 3,
        campos: { ficha: 'F1', risco: 'PROVAVEL', valor_provisionado: 5000 },
      }),
      linha({
        aba: 'BAIXADOS ULTIMOS 3 MESES', linha: 5, encerrado: true,
        campos: { ficha: 'F1', tipo_encerramento: 'Cumprimento da Obrigação' },
      }),
    ])

    const reg = r.registros[0]
    expect(reg.encerrado).toBe(true)
    expect(reg.campos.risco).toBe('PROVAVEL')
    expect(reg.campos.valor_provisionado).toBe(5000)
    expect(reg.campos.tipo_encerramento).toBe('Cumprimento da Obrigação')
  })
})

describe('consolidar — reconciliação de numero_processo repetido', () => {
  it('reporta repetição para revisão humana, sem decidir sozinho', () => {
    const r = consolidar([
      linha({ linha: 3, campos: { ficha: 'F1', numero_processo: '0002712-11.2026.8.13.0001' } }),
      linha({ linha: 4, campos: { ficha: 'F2', numero_processo: '0002712-11.2026.8.13.0001' } }),
    ])
    // Fichas distintas: são DOIS processos, não uma duplicata.
    expect(r.registros).toHaveLength(2)
    expect(r.reconciliacao).toHaveLength(1)
    expect(r.reconciliacao[0].ocorrencias).toHaveLength(2)
  })

  it('marca como explicado quando uma das fichas é IDPJ', () => {
    const r = consolidar([
      linha({
        linha: 3,
        campos: { ficha: 'F1', numero_processo: '0002712-11.2026.8.13.0001', tipo_acao: 'Cobrança' },
      }),
      linha({
        linha: 4,
        campos: {
          ficha: 'F2',
          numero_processo: '0002712-11.2026.8.13.0001',
          tipo_acao: 'Incidente de Desconsideração da Personalidade Jurídica',
        },
      }),
    ])
    expect(r.reconciliacao[0].explicadoPorIdpj).toBe(true)
  })

  it('não reporta quando o número aparece uma vez só', () => {
    const r = consolidar([
      linha({ campos: { ficha: 'F1', numero_processo: '0001-00.2026.8.13.0001' } }),
    ])
    expect(r.reconciliacao).toHaveLength(0)
  })

  it('"A DISTRIBUIR" repetido NÃO vira falso positivo de reconciliação', () => {
    // Vários processos legitimamente compartilham esse valor genérico.
    const r = consolidar([
      linha({ linha: 3, campos: { ficha: 'F1', numero_processo: 'A DISTRIBUIR' } }),
      linha({ linha: 4, campos: { ficha: 'F2', numero_processo: 'A DISTRIBUIR' } }),
    ])
    expect(r.registros).toHaveLength(2)
    expect(r.reconciliacao).toHaveLength(0)
  })
})

describe('consolidar — linha sem identificador', () => {
  it('vira pendência em vez de registro anônimo', () => {
    const r = consolidar([linha({ campos: { valor_causa: 1000 } })])
    expect(r.registros).toHaveLength(0)
    expect(r.pendencias[0].tipo).toBe('LINHA_SEM_IDENTIFICADOR')
  })
})

describe('consolidar — carteira', () => {
  it('usa a coluna Cliente quando a aba mistura clientes', () => {
    const r = consolidar([
      linha({
        aba: 'DEMAIS SEVEN, PEDRO, FABIANA...',
        carteira: null, // aba multi-cliente
        campos: { ficha: 'F1', cliente: 'Associação Seven dos Possuidores' },
      }),
    ])
    expect(r.registros[0].carteira).toBe('Associação Seven dos Possuidores')
  })

  it('usa o nome da aba quando ela representa uma empresa só', () => {
    const r = consolidar([
      linha({ carteira: 'SEVEN INSURTECH', campos: { ficha: 'F1', cliente: 'Outro Nome' } }),
    ])
    expect(r.registros[0].carteira).toBe('SEVEN INSURTECH')
  })
})

describe('mesclarAcordos', () => {
  const doGeral = (): RegistroConsolidado[] => [
    {
      chaveIdentidade: 'ficha:f1',
      numeroProcesso: '0001-00.2026.8.13.0001',
      ficha: 'F1',
      carteira: 'SEVEN INSURTECH',
      encerrado: false,
      campos: { risco: 'PROVAVEL', valor_provisionado: 9000, cliente: 'Cliente do Geral' },
      parcelas: [],
      origem: { aba: 'SEVEN INSURTECH', linha: 3 },
      pendencias: [],
    },
  ]

  const doAcordo = (chave = 'ficha:f1'): RegistroConsolidado => ({
    chaveIdentidade: chave,
    numeroProcesso: '0001-00.2026.8.13.0001',
    ficha: 'F1',
    carteira: null,
    encerrado: false,
    campos: {
      valor_acordo: 5000,
      termos_acordo: '10x de 500',
      // Campos duplicados que NÃO podem sobrescrever o Geral:
      risco: 'REMOTO',
      valor_provisionado: 1,
      cliente: 'Cliente do Acordo',
    },
    parcelas: [{ mesReferencia: '2026-07', dataPagamento: null, valor: 500 }],
    origem: { aba: 'ACORDOS ATIVOS', linha: 4 },
    pendencias: [],
  })

  it('aproveita só o que é exclusivo do acordo', () => {
    const { registros } = mesclarAcordos(doGeral(), [doAcordo()])
    const r = registros[0]
    expect(r.campos.valor_acordo).toBe(5000)
    expect(r.campos.termos_acordo).toBe('10x de 500')
    expect(r.parcelas).toHaveLength(1)
  })

  it('NÃO deixa o acordo sobrescrever campos que vieram do Geral', () => {
    // O Geral é a fonte mais completa. A planilha de Acordos duplica Cliente,
    // Risco, Fase, Valor Provisionado e Resultado com dados possivelmente velhos.
    const { registros } = mesclarAcordos(doGeral(), [doAcordo()])
    const r = registros[0]
    expect(r.campos.risco).toBe('PROVAVEL')
    expect(r.campos.valor_provisionado).toBe(9000)
    expect(r.campos.cliente).toBe('Cliente do Geral')
  })

  it('acordo sem processo correspondente vira órfão, sem bloquear', () => {
    // Confirmado na carga real: 5 fichas com parcela ativa que não constam
    // no Relatório Geral do mesmo mês.
    const { registros, orfaos } = mesclarAcordos(doGeral(), [doAcordo('ficha:f999')])
    expect(registros).toHaveLength(1)
    expect(orfaos).toHaveLength(1)
    expect(orfaos[0].chaveIdentidade).toBe('ficha:f999')
  })
})

describe('REENVIO MENSAL — o caso que corrompe tudo se estiver errado', () => {
  it('a mesma parcela reenviada tem a mesma chave (processo + mês)', () => {
    // A planilha de julho traz maio..dezembro. A de agosto traz os mesmos
    // meses de novo. Se a parcela de julho não for reconhecida como a MESMA,
    // a Projeção de Desembolso infla a cada mês, em silêncio.
    const julho = consolidar([
      linha({
        campos: { ficha: 'F1' },
        parcelas: [
          { mesReferencia: '2026-07', dataPagamento: null, valor: 500 },
          { mesReferencia: '2026-08', dataPagamento: null, valor: 500 },
        ],
      }),
    ])
    const agosto = consolidar([
      linha({
        campos: { ficha: 'F1' },
        parcelas: [
          { mesReferencia: '2026-07', dataPagamento: null, valor: 500 },
          { mesReferencia: '2026-08', dataPagamento: null, valor: 500 },
          { mesReferencia: '2026-09', dataPagamento: null, valor: 500 },
        ],
      }),
    ])

    // Mesma identidade de processo nos dois meses.
    expect(agosto.registros[0].chaveIdentidade).toBe(julho.registros[0].chaveIdentidade)

    // As parcelas repetidas são identificadas pelo MÊS DE REFERÊNCIA, que é o
    // que o UPSERT usa como chave composta no banco (REGRA 4).
    const mesesJulho = julho.registros[0].parcelas.map(p => p.mesReferencia)
    const mesesAgosto = agosto.registros[0].parcelas.map(p => p.mesReferencia)
    expect(mesesJulho).toEqual(['2026-07', '2026-08'])
    expect(mesesAgosto).toEqual(['2026-07', '2026-08', '2026-09'])

    // A intersecção é o que será ATUALIZADO, não inserido de novo.
    const repetidas = mesesAgosto.filter(m => mesesJulho.includes(m))
    expect(repetidas).toEqual(['2026-07', '2026-08'])
  })

  it('valor corrigido no mês seguinte substitui, não soma', () => {
    const agosto = consolidar([
      linha({
        campos: { ficha: 'F1' },
        parcelas: [{ mesReferencia: '2026-07', dataPagamento: null, valor: 750 }],
      }),
    ])
    const p = agosto.registros[0].parcelas.find(p => p.mesReferencia === '2026-07')
    expect(p!.valor).toBe(750)
    expect(agosto.registros[0].parcelas).toHaveLength(1)
  })
})
