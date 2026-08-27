/**
 * Arquivos da marca.
 *
 * Um `<Image src="/marca/ggp-completo.svg">` apontando para arquivo que não
 * existe não quebra o build nem o typecheck — quebra só na tela, como ícone
 * de imagem faltando, e possivelmente só em produção. Este teste transforma
 * isso em falha de CI.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const DIR = path.join(process.cwd(), 'public', 'marca')

const ESPERADOS = [
  { arquivo: 'ggp-completo.png', onde: 'sidebar e tela de login' },
  { arquivo: 'ggp-simbolo.png', onde: 'favicon' },
]

/** Lê largura, altura e tipo de cor do cabeçalho IHDR de um PNG. */
function cabecalhoPng(caminho: string) {
  const d = fs.readFileSync(caminho)
  const assinatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!d.subarray(0, 8).equals(assinatura)) return null
  return {
    largura: d.readUInt32BE(16),
    altura: d.readUInt32BE(20),
    tipoCor: d[25], // 6 = RGBA, 4 = cinza+alfa
  }
}

describe('arquivos da marca', () => {
  for (const { arquivo, onde } of ESPERADOS) {
    it(`${arquivo} existe (usado em ${onde})`, () => {
      const caminho = path.join(DIR, arquivo)
      expect(
        fs.existsSync(caminho),
        `Falta ${caminho}. Ver public/marca/README.md.`
      ).toBe(true)
    })

    it(`${arquivo} não está vazio`, () => {
      const caminho = path.join(DIR, arquivo)
      if (!fs.existsSync(caminho)) return
      expect(fs.statSync(caminho).size).toBeGreaterThan(200)
    })
  }

  for (const { arquivo } of ESPERADOS) {
    it(`${arquivo} tem fundo transparente`, () => {
      // A arte é usada sobre o cinza-claro do painel e sobre o teal-suave do
      // login. Um PNG achatado em branco viraria um retângulo visível nos dois.
      const caminho = path.join(DIR, arquivo)
      if (!fs.existsSync(caminho)) return
      const png = cabecalhoPng(caminho)
      expect(png, `${arquivo} não é um PNG válido`).not.toBeNull()
      expect(
        [4, 6].includes(png!.tipoCor),
        `${arquivo} não tem canal alfa (tipo de cor ${png!.tipoCor})`
      ).toBe(true)
    })
  }
})
