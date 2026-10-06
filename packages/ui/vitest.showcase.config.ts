import { defineConfig } from 'vitest/config'

/** Boots its own Instance in the spec rather than in a global setup, because seeding the Alerts restarts the API. */
export default defineConfig({
  test: {
    name: 'showcase',
    environment: 'node',
    include: ['showcase/**/*.spec.ts'],
    hookTimeout: 300_000,
    fileParallelism: false,
  },
})
