/**
 * Arquivos da marca.
 *
 * Estes testes existem por causa de um erro real: as duas variantes do logo
 * foram salvas com nomes trocados, e a de letras BRANCAS acabou sobre fundo
 * claro. O resultado não foi um erro visível — os "G" simplesmente sumiram e
 * sobrou o "P" teal, que parece um símbolo isolado de propósito.
 *
 * Por isso não basta checar que o arquivo existe: é preciso checar a COR das
 * letras dentro dele.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import zlib from 'node:zlib'

const DIR = path.join(process.cwd(), 'public', 'marca')

const ESPERADOS = [
  {
    arquivo: 'ggp-escuro.png',
    onde: 'sidebar, login e favicon — sobre fundo claro',
    letrasEscuras: true,
  },
  {
    arquivo: 'ggp-claro.png',
    onde: 'reserva para fundo escuro',
    letrasEscuras: false,
  },
]

interface Png {
  largura: number
  altura: number
  tipoCor: number
  linhas: Buffer[]
}

/** Decodifica um PNG RGBA de 8 bits, desfazendo os filtros por linha. */
function lerPng(caminho: string): Png | null {
  const d = fs.readFileSync(caminho)
  if (!d.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return null
  }

  let p = 8
  let largura = 0
  let altura = 0
  let tipoCor = 0
  const idat: Buffer[] = []

  while (p < d.length) {
    const tam = d.readUInt32BE(p)
    const tipo = d.subarray(p + 4, p + 8).toString('latin1')
    if (tipo === 'IHDR') {
      largura = d.readUInt32BE(p + 8)
      altura = d.readUInt32BE(p + 12)
      tipoCor = d[p + 17]
    }
    if (tipo === 'IDAT') idat.push(d.subarray(p + 8, p + 8 + tam))
    p += 12 + tam
  }

  if (tipoCor !== 6) return { largura, altura, tipoCor, linhas: [] }

  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = 4
  const stride = largura * bpp
  const linhas: Buffer[] = []
  let prev = Buffer.alloc(stride)
  let pos = 0

  for (let y = 0; y < altura; y++) {
    const filtro = raw[pos++]
    const cur = Buffer.from(raw.subarray(pos, pos + stride))
    pos += stride

    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      if (filtro === 1) cur[i] = (cur[i] + a) & 255
      else if (filtro === 2) cur[i] = (cur[i] + b) & 255
      else if (filtro === 3) cur[i] = (cur[i] + ((a + b) >> 1)) & 255
      else if (filtro === 4) {
        const pp = a + b - c
        const pa = Math.abs(pp - a)
        const pb = Math.abs(pp - b)
        const pc = Math.abs(pp - c)
        cur[i] = (cur[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255
      }
    }
    linhas.push(cur)
    prev = cur
  }

  return { largura, altura, tipoCor, linhas }
}

/** Luminância média dos pixels opacos que NÃO são o teal da marca. */
function luminanciaDasLetras(png: Png): number | null {
  let soma = 0
  let n = 0
  for (let y = 0; y < png.altura; y += 16) {
    const linha = png.linhas[y]
    if (!linha) continue
    for (let x = 0; x < png.largura; x += 16) {
      const r = linha[x * 4]
      const g = linha[x * 4 + 1]
      const b = linha[x * 4 + 2]
      const alfa = linha[x * 4 + 3]
      if (alfa < 200) continue
      // O "P" é teal (#00819c): azul bem acima do vermelho. Descarta para
      // medir só as letras "G" e o texto, que é o que muda entre variantes.
      if (b > r + 40) continue
      soma += 0.2126 * r + 0.7152 * g + 0.0722 * b
      n++
    }
  }
  return n > 0 ? soma / n : null
}

describe('arquivos da marca', () => {
  for (const { arquivo, onde } of ESPERADOS) {
    it(`${arquivo} existe (${onde})`, () => {
      expect(
        fs.existsSync(path.join(DIR, arquivo)),
        `Falta ${path.join(DIR, arquivo)}. Ver public/marca/README.md.`
      ).toBe(true)
    })
  }

  for (const { arquivo } of ESPERADOS) {
    it(`${arquivo} tem fundo transparente`, () => {
      // Sem alfa, o PNG vira um retângulo branco sobre o cinza do painel.
      const png = lerPng(path.join(DIR, arquivo))
      expect(png, `${arquivo} não é um PNG válido`).not.toBeNull()
      expect(png!.tipoCor, `${arquivo} não tem canal alfa`).toBe(6)
    })
  }

  for (const { arquivo, letrasEscuras } of ESPERADOS) {
    it(`${arquivo} tem letras ${letrasEscuras ? 'ESCURAS' : 'CLARAS'}`, () => {
      // O erro que motivou este teste: variante branca usada em fundo claro,
      // fazendo os "G" desaparecerem sem nenhum sinal de falha.
      const png = lerPng(path.join(DIR, arquivo))
      const lum = luminanciaDasLetras(png!)
      expect(lum, 'nenhum pixel de letra encontrado').not.toBeNull()

      if (letrasEscuras) {
        expect(lum!, `letras claras demais (luminância ${lum!.toFixed(0)})`).toBeLessThan(100)
      } else {
        expect(lum!, `letras escuras demais (luminância ${lum!.toFixed(0)})`).toBeGreaterThan(150)
      }
    })
  }

  it('o desenho é 2:1, e não quadrado como a moldura do arquivo', () => {
    // Tratar o arquivo como quadrado esticava o logo. A moldura é 4800×4800,
    // mas o desenho ocupa só a faixa central.
    const png = lerPng(path.join(DIR, 'ggp-escuro.png'))!
    let minX = png.largura
    let maxX = 0
    let minY = png.altura
    let maxY = 0

    for (let y = 0; y < png.altura; y += 8) {
      const linha = png.linhas[y]
      for (let x = 0; x < png.largura; x += 8) {
        if (linha[x * 4 + 3] > 128) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }

    const proporcao = (maxX - minX) / (maxY - minY)
    expect(proporcao).toBeGreaterThan(1.8)
    expect(proporcao).toBeLessThan(2.3)
  })
})
