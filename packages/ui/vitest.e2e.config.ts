import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['e2e/**/*.spec.ts'],
    root: fileURLToPath(new URL('./', import.meta.url)),
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
})
