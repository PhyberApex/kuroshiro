import type { TestSpecification } from 'vitest/node'
import { defineConfig } from 'vitest/config'
import { BaseSequencer } from 'vitest/node'

const isSmoke = (spec: TestSpecification) => spec.moduleId.endsWith('/smoke.spec.ts')

/** Every spec shares one Instance, and `smoke.spec.ts` starts on the empty one, so it runs before any journey adds a Device. */
class SmokeFirst extends BaseSequencer {
  override async sort(specs: TestSpecification[]) {
    const sorted = await super.sort(specs)
    return [...sorted.filter(isSmoke), ...sorted.filter(spec => !isSmoke(spec))]
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
    sequence: { sequencer: SmokeFirst },
  },
})
