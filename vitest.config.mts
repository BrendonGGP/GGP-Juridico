import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      // Espelha o `paths` do tsconfig.json. Sem isto o vitest não resolve "@/".
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    // .tsx entra porque as telas também são verificadas (renderização com
    // dados reais, ver tests/telas.test.tsx).
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
    },
  },
})
