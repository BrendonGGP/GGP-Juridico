/**
 * Filtro de dado sensível da trilha de auditoria.
 *
 * O CLAUDE.md proíbe PII e valor por processo em log. Quem chama `registrar`
 * é responsável por não passar essas coisas — este filtro é a SEGUNDA linha
 * de defesa, para o caso de um `detalhe` montado com spread de um objeto
 * maior carregar campos que ninguém pretendia gravar.
 *
 * Um vazamento aqui é permanente: log de auditoria não se apaga, é justamente
 * o registro que precisa ser confiável.
 */
import { describe, it, expect } from 'vitest'
import { _limparParaTeste as limpar } from '@/lib/auth/auditoria'

describe('filtro de auditoria', () => {
  it('remove os campos sensíveis nomeados no CLAUDE.md', () => {
    const sujo = {
      cpf: '123.456.789-00',
      email: 'pessoa@empresa.com',
      telefone: '11999998888',
      placa: 'ABC1D23',
      valorAcordo: 150000,
      valorProvisionado: 90000,
      nomeParte: 'Fulano de Tal',
    }
    const limpo = limpar(sujo)

    for (const chave of Object.keys(sujo)) {
      expect(limpo[chave], `${chave} deveria ter sido removido`).toBe('[removido]')
    }
  })

  it('preserva o que é legítimo auditar', () => {
    const limpo = limpar({
      mesReferencia: '2026-07',
      totalProcessos: 836,
      dryRun: false,
      perfil: 'JURIDICO',
    })

    expect(limpo.mesReferencia).toBe('2026-07')
    expect(limpo.totalProcessos).toBe(836)
    expect(limpo.dryRun).toBe(false)
    expect(limpo.perfil).toBe('JURIDICO')
  })

  it('pega o campo sensível apesar de acento, maiúscula ou separador', () => {
    // "E-mail", "CPF_do_autor", "Endereço" precisam cair no mesmo filtro que
    // "email" — senão a proteção depende de quem escreve acertar a grafia.
    const limpo = limpar({
      'E-Mail': 'a@b.com',
      CPF_do_autor: '000',
      Endereço: 'Rua X',
      TELEFONE: '119',
    })

    expect(limpo['E-Mail']).toBe('[removido]')
    expect(limpo.CPF_do_autor).toBe('[removido]')
    expect(limpo['Endereço']).toBe('[removido]')
    expect(limpo.TELEFONE).toBe('[removido]')
  })

  it('não deixa objeto aninhado passar', () => {
    // O filtro só inspeciona chaves do primeiro nível. Um objeto aninhado
    // esconderia dado sensível dele, então nenhum objeto é gravado.
    const limpo = limpar({
      processo: { autor: 'Fulano', valorAcordo: 50000 },
      lista: [1, 2, 3],
    })

    expect(limpo.processo).toBe('[objeto omitido]')
    expect(limpo.lista).toBe('[objeto omitido]')
  })

  it('remove segredo, não só PII', () => {
    const limpo = limpar({ token: 'abc', apiKey: 'xyz', senha: '123' })
    expect(limpo.token).toBe('[removido]')
    expect(limpo.apiKey).toBe('[removido]')
    expect(limpo.senha).toBe('[removido]')
  })

  it('mantém null, que é informação legítima', () => {
    expect(limpar({ mesAnterior: null }).mesAnterior).toBeNull()
  })
})
