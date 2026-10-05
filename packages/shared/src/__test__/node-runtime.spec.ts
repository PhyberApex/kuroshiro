import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { describe, expect, it } from 'vitest'

const barrel = new URL('../index.ts', import.meta.url).href

// `pnpm dev:api` runs the API's compiled output under plain Node, which loads this
// package's TypeScript sources through Node's own type stripping, without a bundler.
describe('the package under plain Node', () => {
  it('loads its barrel and exposes its runtime exports', () => {
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `const shared = await import(${JSON.stringify(barrel)}); console.log(typeof shared.renderLiquid)`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )

    expect(output.trim()).toBe('function')
  })
})
