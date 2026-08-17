import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { FindOptionsUtils, TypeORMError } from 'typeorm'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard for https://github.com/PhyberApex/kuroshiro/issues/722
 *
 * TypeORM v1 removed the string-array `relations` syntax
 * (e.g. `relations: ['plugin']`). Any repository call still using it throws
 * `TypeORMError: String-array "relations" syntax has been removed.` at
 * runtime, which crashed the API container on boot after the 0.10.0 update.
 *
 * Unit tests mock the repositories, so the crash is invisible to them.
 * This spec (1) documents the real TypeORM behaviour and (2) statically
 * scans the API source tree so a reintroduced string-array `relations`
 * option fails CI instead of crashing production.
 */

const SRC_ROOT = join(__dirname, '..')
const STRING_ARRAY_RELATIONS = /\brelations:\s*\[/

function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      // Spec files assert on mocked calls; only production sources reach TypeORM.
      if (entry === '__test__' || entry === 'node_modules')
        continue
      files.push(...collectSourceFiles(fullPath))
    }
    else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      files.push(fullPath)
    }
  }
  return files
}

describe('typeORM v1 relations syntax', () => {
  it('rejects the removed string-array relations syntax at runtime', () => {
    expect(() =>
      FindOptionsUtils.rejectStringArrayRelations({ relations: ['plugin'] }),
    ).toThrow(TypeORMError)
  })

  it('accepts the object relations syntax', () => {
    expect(() =>
      FindOptionsUtils.rejectStringArrayRelations({
        relations: { plugin: { dataSource: true, templates: true } },
      }),
    ).not.toThrow()
  })

  it('has no string-array relations left in the API source tree', () => {
    const offenders = collectSourceFiles(SRC_ROOT).filter(file =>
      STRING_ARRAY_RELATIONS.test(readFileSync(file, 'utf8')),
    )

    expect(
      offenders,
      `String-array \`relations\` syntax was removed in TypeORM v1 and crashes on boot (issue #722). Use object syntax, e.g. relations: { plugin: true }. Offending files:\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
