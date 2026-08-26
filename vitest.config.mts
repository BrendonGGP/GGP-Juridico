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
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
    },
  },
})
