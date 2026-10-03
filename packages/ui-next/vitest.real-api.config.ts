import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'real-api',
    environment: 'node',
    include: ['real-api/**/*.spec.ts'],
    globalSetup: ['real-api/globalSetup.ts'],
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
})
