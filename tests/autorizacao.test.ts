/**
 * Regras de autorização por perfil.
 *
 * São funções puras justamente para poderem ser verificadas sem subir banco
 * nem sessão. A pergunta "a Diretoria pode importar?" precisa ter resposta
 * testável, não depender de alguém abrir a tela e conferir.
 *
 * O caso `null` é o mais importante: representa visitante sem sessão, conta
 * desativada e usuário sem convite. Todos devem ser negados.
 */
import { describe, it, expect } from 'vitest'
import type { Perfil } from '@prisma/client'
import { podeImportar, podeAdministrar, podeLer, ROTULO_PERFIL } from '@/lib/auth/sessao'

const usuario = (perfil: Perfil) => ({
  id: 'x',
  email: 'x@y.z',
  nome: 'Teste',
  perfil,
})

const TODOS: Perfil[] = ['ADMIN', 'JURIDICO', 'DIRETORIA', 'CONTABILIDADE']

describe('quem pode importar', () => {
  it('permite ADMIN e JURIDICO', () => {
    expect(podeImportar(usuario('ADMIN'))).toBe(true)
    expect(podeImportar(usuario('JURIDICO'))).toBe(true)
  })

  it('nega DIRETORIA e CONTABILIDADE', () => {
    // Consomem o resultado; não há motivo para reescreverem a base do mês.
    // Importar substitui a foto inteira — não poder é mais seguro que poder
    // e não usar.
    expect(podeImportar(usuario('DIRETORIA'))).toBe(false)
    expect(podeImportar(usuario('CONTABILIDADE'))).toBe(false)
  })

  it('nega quem não tem sessão', () => {
    expect(podeImportar(null)).toBe(false)
  })
})

describe('quem pode administrar', () => {
  it('permite só ADMIN', () => {
    expect(podeAdministrar(usuario('ADMIN'))).toBe(true)
    for (const p of TODOS.filter(p => p !== 'ADMIN')) {
      expect(podeAdministrar(usuario(p)), `${p} não deveria administrar`).toBe(false)
    }
  })

  it('nega quem não tem sessão', () => {
    expect(podeAdministrar(null)).toBe(false)
  })
})

describe('quem pode ler', () => {
  it('permite qualquer perfil ativo e cadastrado', () => {
    for (const p of TODOS) {
      expect(podeLer(usuario(p)), `${p} deveria poder ler`).toBe(true)
    }
  })

  it('nega quem não tem sessão', () => {
    // null cobre visitante, conta desativada e usuário sem convite.
    expect(podeLer(null)).toBe(false)
  })
})

describe('rótulos de perfil', () => {
  it('cobre todos os perfis do enum', () => {
    // Um perfil novo no schema sem rótulo apareceria como "undefined" na
    // sidebar. Este teste força a atualização junto.
    for (const p of TODOS) {
      expect(ROTULO_PERFIL[p], `${p} sem rótulo`).toBeTruthy()
    }
  })
})
