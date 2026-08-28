/**
 * Configuração de ambiente.
 *
 * O caso que motivou estes testes: a trava da importação comparava
 * `APP_ENV === 'production'`. Com a variável ausente, ou escrita `Production`,
 * a comparação dava falso e o endpoint ABRIA — numa trava que existe porque a
 * autenticação ainda não foi construída.
 *
 * `lib/config.ts` valida no carregamento do módulo, então cada cenário precisa
 * de um import isolado com o ambiente já preparado.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

async function carregarConfig(env: Record<string, string | undefined>) {
  vi.resetModules()
  const original = { ...process.env }
  // Limpa só as chaves que o schema lê, para não herdar o .env da máquina.
  for (const k of [
    'APP_ENV',
    'DATABASE_URL',
    'MAX_UPLOAD_MB',
    'MAX_LINHAS_PLANILHA',
    'TIMEOUT_INGESTAO_SEGUNDOS',
    'AUDIT_LOG_HABILITADO',
    'LOG_LEVEL',
    'LLM_SUMARIO_HABILITADO',
  ]) {
    delete process.env[k]
  }
  Object.assign(process.env, env)

  try {
    return await import('@/lib/config')
  } finally {
    process.env = original
  }
}

beforeEach(() => vi.resetModules())

describe('ambiente', () => {
  it('sem APP_ENV, assume development — o modo restritivo', () => {
    // Ausência nunca deve ser lida como produção liberada nem como produção
    // silenciosa: cai no ambiente onde nada real acontece.
    return carregarConfig({}).then(c => {
      expect(c.config.APP_ENV).toBe('development')
      expect(c.ehDesenvolvimento).toBe(true)
      expect(c.ehProducao).toBe(false)
    })
  })

  it('reconhece os três ambientes válidos', async () => {
    expect((await carregarConfig({ APP_ENV: 'production' })).ehProducao).toBe(true)
    expect((await carregarConfig({ APP_ENV: 'staging' })).ehProducao).toBe(false)
    expect((await carregarConfig({ APP_ENV: 'staging' })).ehDesenvolvimento).toBe(false)
  })

  it('REJEITA grafia inválida em vez de aceitar em silêncio', async () => {
    // Este é o bug antigo: "Production" com maiúscula passava pela comparação
    // de string e deixava a trava aberta. Agora falha ao carregar.
    await expect(carregarConfig({ APP_ENV: 'Production' })).rejects.toThrow(
      /APP_ENV/
    )
    await expect(carregarConfig({ APP_ENV: 'prod' })).rejects.toThrow(/APP_ENV/)
  })

  it('staging NÃO é desenvolvimento — a trava fecha nele', async () => {
    // A trava da importação usa `!ehDesenvolvimento`. Se staging contasse
    // como desenvolvimento, o endpoint abriria num ambiente com dado real.
    const c = await carregarConfig({ APP_ENV: 'staging' })
    expect(c.ehDesenvolvimento).toBe(false)
  })
})

describe('limites de ingestão', () => {
  it('tem padrões seguros sem nenhuma variável', async () => {
    const { config } = await carregarConfig({})
    expect(config.MAX_UPLOAD_MB).toBe(25)
    expect(config.MAX_LINHAS_PLANILHA).toBe(5000)
    expect(config.TIMEOUT_INGESTAO_SEGUNDOS).toBe(300)
  })

  it('converte texto para número', async () => {
    const { config } = await carregarConfig({ MAX_UPLOAD_MB: '10' })
    expect(config.MAX_UPLOAD_MB).toBe(10)
  })

  it('rejeita limite não numérico ou negativo', async () => {
    await expect(carregarConfig({ MAX_UPLOAD_MB: 'muito' })).rejects.toThrow()
    await expect(carregarConfig({ MAX_LINHAS_PLANILHA: '-1' })).rejects.toThrow()
  })
})

describe('chaves booleanas', () => {
  it('a superfície de LLM entra DESLIGADA', async () => {
    // §3.3: só liga depois do fallback determinístico validado.
    expect((await carregarConfig({})).config.LLM_SUMARIO_HABILITADO).toBe(false)
    expect(
      (await carregarConfig({ LLM_SUMARIO_HABILITADO: 'sim' })).config
        .LLM_SUMARIO_HABILITADO
    ).toBe(false)
    expect(
      (await carregarConfig({ LLM_SUMARIO_HABILITADO: 'true' })).config
        .LLM_SUMARIO_HABILITADO
    ).toBe(true)
  })

  it('a auditoria entra LIGADA e só desliga com "false" literal', async () => {
    expect((await carregarConfig({})).config.AUDIT_LOG_HABILITADO).toBe(true)
    expect(
      (await carregarConfig({ AUDIT_LOG_HABILITADO: 'nao' })).config.AUDIT_LOG_HABILITADO
    ).toBe(true)
    expect(
      (await carregarConfig({ AUDIT_LOG_HABILITADO: 'false' })).config.AUDIT_LOG_HABILITADO
    ).toBe(false)
  })
})

describe('mensagem de erro', () => {
  it('nomeia a variável com problema mas NÃO imprime o valor', async () => {
    // Uma connection string malformada num log de erro é segredo vazado.
    const segredo = 'postgresql://usuario:senha-secreta@host/banco'
    await expect(
      carregarConfig({ DATABASE_URL: segredo, APP_ENV: 'invalido' })
    ).rejects.toThrow(/APP_ENV/)

    try {
      await carregarConfig({ DATABASE_URL: segredo, APP_ENV: 'invalido' })
    } catch (e) {
      expect(String(e)).not.toContain('senha-secreta')
      expect(String(e)).not.toContain(segredo)
    }
  })
})
