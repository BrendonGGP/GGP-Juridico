/**
 * Validação de arquivo enviado, ANTES de qualquer parsing.
 *
 * A planilha vem de um prestador externo e é mantida à mão. É entrada não
 * confiável: pode ter macro, pode ser um arquivo renomeado, pode ser grande o
 * suficiente para derrubar o processo. Tudo aqui roda sobre bytes, sem abrir a
 * planilha — abrir já é executar código de parsing sobre dado hostil.
 *
 * Falha FECHADA: o que não passar em todas as checagens é rejeitado.
 */

export interface LimitesUpload {
  tamanhoMaximoBytes: number
  maxAbas: number
  maxLinhasPorAba: number
  /** Razão máxima entre tamanho descomprimido e comprimido (anti zip bomb). */
  razaoCompressaoMaxima: number
}

export const LIMITES_PADRAO: LimitesUpload = {
  tamanhoMaximoBytes: 25 * 1024 * 1024,
  maxAbas: 20,
  maxLinhasPorAba: 5000,
  razaoCompressaoMaxima: 200,
}

export interface ResultadoValidacao {
  ok: boolean
  /** Motivos da recusa. Vazio quando ok. */
  erros: string[]
  /** Observações que não impedem a importação. */
  avisos: string[]
}

/** Assinatura de arquivo ZIP — todo .xlsx é um ZIP. */
const ASSINATURA_ZIP = [0x50, 0x4b, 0x03, 0x04]
/** ZIP vazio e ZIP spanned: válidos como ZIP, inválidos como planilha. */
const ASSINATURAS_ZIP_INVALIDAS = [
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
]

/** Formato antigo do Excel (.xls, OLE2). Rejeitado: só aceitamos .xlsx. */
const ASSINATURA_OLE2 = [0xd0, 0xcf, 0x11, 0xe0]

function comecaCom(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false
  return bytes.every((b, i) => buf[i] === b)
}

/**
 * Procura um nome de entrada dentro do ZIP sem descomprimir.
 *
 * Os nomes de arquivo ficam em texto puro no cabeçalho local e no diretório
 * central, então a busca por bytes é suficiente e não custa parsing.
 */
function contemEntrada(buf: Buffer, nome: string): boolean {
  return buf.includes(Buffer.from(nome, 'latin1'))
}

/**
 * Soma os tamanhos descomprimidos declarados no diretório central do ZIP.
 *
 * Serve para barrar zip bomb antes de descomprimir. É o valor DECLARADO pelo
 * arquivo — um atacante pode mentir — mas mentir para baixo não ajuda: o
 * limite de abas e de linhas pega o excesso depois, na leitura.
 */
function tamanhoDescomprimidoDeclarado(buf: Buffer): number | null {
  // Fim do diretório central: assinatura PK\x05\x06, nos últimos 64KB.
  const inicio = Math.max(0, buf.length - 65_536)
  let eocd = -1
  for (let i = buf.length - 22; i >= inicio; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      eocd = i
      break
    }
  }
  if (eocd === -1) return null

  const totalEntradas = buf.readUInt16LE(eocd + 10)
  let offset = buf.readUInt32LE(eocd + 16)
  let total = 0

  for (let n = 0; n < totalEntradas; n++) {
    // Cabeçalho do diretório central: PK\x01\x02
    if (offset + 46 > buf.length) return null
    if (!(buf[offset] === 0x50 && buf[offset + 1] === 0x4b &&
          buf[offset + 2] === 0x01 && buf[offset + 3] === 0x02)) {
      return null
    }
    total += buf.readUInt32LE(offset + 24) // tamanho descomprimido
    const nomeLen = buf.readUInt16LE(offset + 28)
    const extraLen = buf.readUInt16LE(offset + 30)
    const comentLen = buf.readUInt16LE(offset + 32)
    offset += 46 + nomeLen + extraLen + comentLen
  }

  return total
}

export function validarUpload(
  nomeArquivo: string,
  buffer: Buffer,
  limites: LimitesUpload = LIMITES_PADRAO
): ResultadoValidacao {
  const erros: string[] = []
  const avisos: string[] = []

  // --- Nome e extensão -----------------------------------------------------
  const nome = nomeArquivo.trim()
  if (nome === '') {
    erros.push('Arquivo sem nome.')
  }
  // Path traversal: o nome vem do cliente e nunca deve virar caminho.
  if (/[/\\]|\.\./.test(nome)) {
    erros.push('Nome de arquivo com caminho — rejeitado.')
  }

  const ext = nome.slice(nome.lastIndexOf('.')).toLowerCase()
  if (ext === '.xlsm') {
    erros.push('Arquivo .xlsm (com macros) não é aceito. Salve como .xlsx.')
  } else if (ext === '.xls') {
    erros.push('Formato .xls antigo não é aceito. Salve como .xlsx.')
  } else if (ext !== '.xlsx') {
    erros.push(`Extensão ${JSON.stringify(ext)} não aceita. Use .xlsx.`)
  }

  // --- Tamanho -------------------------------------------------------------
  if (buffer.length === 0) {
    erros.push('Arquivo vazio.')
  } else if (buffer.length > limites.tamanhoMaximoBytes) {
    const mb = (limites.tamanhoMaximoBytes / 1024 / 1024).toFixed(0)
    erros.push(`Arquivo maior que o limite de ${mb} MB.`)
  }

  // --- Conteúdo real, não a extensão --------------------------------------
  // Renomear .xlsm para .xlsx é trivial; a checagem de extensão sozinha não vale.
  if (buffer.length >= 4) {
    if (comecaCom(buffer, ASSINATURA_OLE2)) {
      erros.push('O conteúdo é um .xls antigo, apesar da extensão. Salve como .xlsx.')
    } else if (ASSINATURAS_ZIP_INVALIDAS.some(a => comecaCom(buffer, a))) {
      erros.push('Arquivo ZIP vazio ou incompleto.')
    } else if (!comecaCom(buffer, ASSINATURA_ZIP)) {
      erros.push('O conteúdo não é uma planilha .xlsx válida.')
    }
  }

  if (erros.length === 0) {
    // --- Macros ------------------------------------------------------------
    // Um .xlsx renomeado a partir de .xlsm continua carregando o projeto VBA.
    if (contemEntrada(buffer, 'vbaProject.bin')) {
      erros.push('A planilha contém macros (vbaProject.bin). Remova as macros e reenvie.')
    }

    // --- Estrutura mínima de planilha --------------------------------------
    if (!contemEntrada(buffer, 'xl/workbook.xml')) {
      erros.push('O arquivo é um ZIP, mas não tem estrutura de planilha Excel.')
    }

    // --- Vínculos externos --------------------------------------------------
    // Fórmula que busca dado de fora é vetor de exfiltração e de erro silencioso.
    if (contemEntrada(buffer, 'externalLink')) {
      avisos.push(
        'A planilha tem vínculos externos. Eles são ignorados na leitura, mas ' +
          'podem indicar valores que dependem de outro arquivo.'
      )
    }

    // --- Zip bomb ------------------------------------------------------------
    const descomprimido = tamanhoDescomprimidoDeclarado(buffer)
    if (descomprimido !== null && buffer.length > 0) {
      const razao = descomprimido / buffer.length
      if (razao > limites.razaoCompressaoMaxima) {
        erros.push(
          `Razão de compressão suspeita (${razao.toFixed(0)}x). ` +
            'O arquivo pode estar malformado ou ser uma zip bomb.'
        )
      }
    }
  }

  return { ok: erros.length === 0, erros, avisos }
}

/**
 * Checagem estrutural DEPOIS de abrir a planilha.
 *
 * Separada de propósito: só roda quando as checagens sobre bytes já passaram,
 * e serve para limitar o custo do processamento, não para barrar conteúdo
 * hostil — isso já foi feito acima.
 */
export function validarEstrutura(
  abas: { nome: string; linhas: number }[],
  limites: LimitesUpload = LIMITES_PADRAO
): ResultadoValidacao {
  const erros: string[] = []
  const avisos: string[] = []

  if (abas.length === 0) {
    erros.push('A planilha não tem nenhuma aba legível.')
  }
  if (abas.length > limites.maxAbas) {
    erros.push(`A planilha tem ${abas.length} abas; o limite é ${limites.maxAbas}.`)
  }

  for (const a of abas) {
    if (a.linhas > limites.maxLinhasPorAba) {
      erros.push(
        `A aba ${JSON.stringify(a.nome)} tem ${a.linhas} linhas; ` +
          `o limite é ${limites.maxLinhasPorAba}.`
      )
    }
    // Limite do Excel. Uma aba maior que isso não veio do Excel.
    if (a.nome.length > 31) {
      avisos.push(`Nome de aba com mais de 31 caracteres: ${JSON.stringify(a.nome)}.`)
    }
  }

  return { ok: erros.length === 0, erros, avisos }
}
