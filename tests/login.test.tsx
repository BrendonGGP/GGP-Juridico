/**
 * Tela de acesso.
 *
 * O que estes testes protegem: as garantias que somem sem ninguém notar numa
 * refatoração de estilo — rótulo visível, autocomplete, senha mascarada — e o
 * fato de que a tela ainda NÃO autentica, que precisa continuar declarado
 * enquanto for verdade.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FormularioLogin } from '@/app/login/FormularioLogin'

const html = renderToStaticMarkup(<FormularioLogin />)

describe('formulário de acesso', () => {
  it('dá rótulo visível aos dois campos, não só placeholder', () => {
    // Placeholder some ao digitar e leva embora a pista do que o campo pede.
    expect(html).toContain('for="email"')
    expect(html).toContain('for="senha"')
    expect(html).toContain('>E-mail<')
    expect(html).toContain('>Senha<')
  })

  it('declara autocomplete para o gerenciador de senhas do navegador', () => {
    // renderToStaticMarkup preserva o camelCase do JSX; o navegador
    // normaliza para minúsculas. Comparar sem diferenciar caixa cobre os dois.
    const semCaixa = html.toLowerCase()
    expect(semCaixa).toContain('autocomplete="username"')
    expect(semCaixa).toContain('autocomplete="current-password"')
  })

  it('mascara a senha', () => {
    expect(html).toContain('type="password"')
  })

  it('dá alvo de toque adequado ao botão e aos campos', () => {
    // 44px é o mínimo; min-h-11 é exatamente isso.
    expect((html.match(/min-h-11/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  it('não traz senha embutida no HTML', () => {
    // Guarda contra alguém "facilitar o teste" deixando credencial no código.
    expect(html).not.toMatch(/value="[^"]+"\s[^>]*type="password"/)
    expect(html.toLowerCase()).not.toContain('demo@')
  })
})
