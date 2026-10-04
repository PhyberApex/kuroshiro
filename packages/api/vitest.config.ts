import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Under coverage on a loaded CI runner, a real-database spec building its schema in beforeAll outruns the
    // 10 second hook default, and a guard parsing the whole source tree outruns the 5 second test default.
    hookTimeout: 30_000,
    testTimeout: 20_000,
  },
})
