import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { validarUpload, validarEstrutura, LIMITES_PADRAO } from '@/lib/ingestao/validar-upload'

/** Planilha .xlsx mínima e válida, gerada em memória. */
function xlsxValido(): Buffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Ficha'], ['F1']]), 'ABA')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

describe('validarUpload — aceita o que deve', () => {
  it('aceita um .xlsx legítimo', () => {
    const r = validarUpload('relatorio.xlsx', xlsxValido())
    expect(r.ok).toBe(true)
    expect(r.erros).toEqual([])
  })

  it('aceita nome com espaços e acentos, como os arquivos reais', () => {
    const r = validarUpload(
      'RELATORIO GERAL (GGP) - JULHO-2026 enviado em 05.08.2026 (1).xlsx',
      xlsxValido()
    )
    expect(r.ok).toBe(true)
  })
})

describe('validarUpload — extensão', () => {
  it('rejeita .xlsm, que carrega macros', () => {
    const r = validarUpload('planilha.xlsm', xlsxValido())
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toContain('macros')
  })

  it('rejeita .xls antigo', () => {
    const r = validarUpload('planilha.xls', xlsxValido())
    expect(r.ok).toBe(false)
  })

  it('rejeita qualquer outra extensão', () => {
    for (const nome of ['a.csv', 'a.pdf', 'a.exe', 'a.zip', 'a']) {
      expect(validarUpload(nome, xlsxValido()).ok).toBe(false)
    }
  })
})

describe('validarUpload — conteúdo, não a extensão', () => {
  it('rejeita .xls renomeado para .xlsx', () => {
    // Assinatura OLE2 do formato antigo.
    const ole2 = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(1000),
    ])
    const r = validarUpload('disfarcado.xlsx', ole2)
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toContain('.xls antigo')
  })

  it('rejeita arquivo qualquer renomeado para .xlsx', () => {
    const r = validarUpload('falso.xlsx', Buffer.from('isto é só um texto'))
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toContain('não é uma planilha')
  })

  it('rejeita ZIP que não é planilha', () => {
    // ZIP válido, mas sem xl/workbook.xml.
    const zip = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('conteudo qualquer sem estrutura de excel'),
    ])
    const r = validarUpload('generico.xlsx', zip)
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toContain('estrutura de planilha')
  })

  it('rejeita macro mesmo com extensão .xlsx', () => {
    // Renomear .xlsm para .xlsx não remove o projeto VBA de dentro do ZIP.
    const comMacro = Buffer.concat([
      xlsxValido(),
      Buffer.from('xl/vbaProject.bin'),
    ])
    const r = validarUpload('renomeado.xlsx', comMacro)
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toContain('macros')
  })
})

describe('validarUpload — tamanho e path', () => {
  it('rejeita arquivo vazio', () => {
    expect(validarUpload('vazio.xlsx', Buffer.alloc(0)).ok).toBe(false)
  })

  it('rejeita acima do limite de tamanho', () => {
    const grande = Buffer.alloc(LIMITES_PADRAO.tamanhoMaximoBytes + 1)
    const r = validarUpload('grande.xlsx', grande)
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toContain('MB')
  })

  it('rejeita nome de arquivo com caminho — path traversal', () => {
    for (const nome of ['../../etc/passwd.xlsx', 'pasta/arquivo.xlsx', '..\\win.xlsx']) {
      const r = validarUpload(nome, xlsxValido())
      expect(r.ok).toBe(false)
      expect(r.erros.join(' ')).toContain('caminho')
    }
  })
})

describe('validarUpload — falha fechada', () => {
  it('acumula todos os motivos, sem parar no primeiro', () => {
    const r = validarUpload('../a.exe', Buffer.from('lixo'))
    expect(r.ok).toBe(false)
    expect(r.erros.length).toBeGreaterThan(1)
  })
})

describe('validarEstrutura', () => {
  it('aceita a estrutura real: 6 abas, a maior com ~800 linhas', () => {
    const r = validarEstrutura([
      { nome: 'GERAL', linhas: 799 },
      { nome: 'DEMAIS SEVEN, PEDRO, FABIANA...', linhas: 389 },
      { nome: 'SPLIT RISK SEGURADORA S.A', linhas: 300 },
      { nome: 'REGRESSIVAS DE COBRANÇA - SPLIT', linhas: 26 },
      { nome: 'SEVEN INSURTECH', linhas: 84 },
      { nome: 'BAIXADOS ULTIMOS 3 MESES', linhas: 37 },
    ])
    expect(r.ok).toBe(true)
    expect(r.avisos).toEqual([])
  })

  it('rejeita planilha sem aba legível', () => {
    expect(validarEstrutura([]).ok).toBe(false)
  })

  it('rejeita excesso de abas', () => {
    const abas = Array.from({ length: 21 }, (_, i) => ({ nome: `A${i}`, linhas: 1 }))
    expect(validarEstrutura(abas).ok).toBe(false)
  })

  it('rejeita aba com linhas demais', () => {
    const r = validarEstrutura([{ nome: 'X', linhas: 5001 }])
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toContain('5001')
  })

  it('avisa sobre nome de aba acima do limite do Excel', () => {
    const r = validarEstrutura([{ nome: 'A'.repeat(32), linhas: 1 }])
    expect(r.avisos.join(' ')).toContain('31 caracteres')
    // É aviso, não erro: não impede a importação.
    expect(r.ok).toBe(true)
  })
})
