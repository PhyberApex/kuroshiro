import type { TestSpecification } from 'vitest/node'
import { defineConfig } from 'vitest/config'
import { BaseSequencer } from 'vitest/node'

const isFirstRun = (spec: TestSpecification) => spec.moduleId.endsWith('/firstRun.spec.ts')

/** Every spec shares one Instance, and `firstRun.spec.ts` starts on the empty one, so it runs before any other spec adds a Device. */
class FirstRunFirst extends BaseSequencer {
  override async sort(specs: TestSpecification[]) {
    const sorted = await super.sort(specs)
    return [...sorted.filter(isFirstRun), ...sorted.filter(spec => !isFirstRun(spec))]
  }
}

export default defineConfig({
  test: {
    name: 'real-api',
    environment: 'node',
    include: ['real-api/**/*.spec.ts'],
    globalSetup: ['real-api/globalSetup.ts'],
    testTimeout: 30_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    sequence: { sequencer: FirstRunFirst },
  },
})
