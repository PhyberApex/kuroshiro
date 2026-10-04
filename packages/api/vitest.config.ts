import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Specs with a real database build its whole schema in beforeAll, which outruns the 10 second default on a loaded CI runner.
    hookTimeout: 30_000,
  },
})
