import type { MigrationInterface, QueryRunner } from 'typeorm'
import { describe, expect, it, vi } from 'vitest'
import { RemovePluginVariables1787190000000 } from '../1787190000000-RemovePluginVariables.js'
import { DropPerDeviceFieldValues1787190000001 } from '../1787190000001-DropPerDeviceFieldValues.js'
import { FieldValuesBelongToPlugin1787190000002 } from '../1787190000002-FieldValuesBelongToPlugin.js'
import { AddPluginFieldOptions1787190000003 } from '../1787190000003-AddPluginFieldOptions.js'

async function queriesOf(migration: MigrationInterface, direction: 'up' | 'down'): Promise<string[]> {
  const query = vi.fn().mockResolvedValue(undefined)
  await migration[direction]({ query } as unknown as QueryRunner)
  return query.mock.calls.map(call => call[0] as string)
}

describe('the Field Value migrations (ADR-0032)', () => {
  it('drops the Plugin Variable table, and restores it on the way down', async () => {
    const migration = new RemovePluginVariables1787190000000()

    expect(await queriesOf(migration, 'up')).toEqual([expect.stringContaining('DROP TABLE IF EXISTS "plugin_variable"')])
    expect((await queriesOf(migration, 'down')).some(q => q.includes('CREATE TABLE "plugin_variable"'))).toBe(true)
  })

  it('deletes per-Device Field Values and all but one value per Plugin Field', async () => {
    const queries = await queriesOf(new DropPerDeviceFieldValues1787190000001(), 'up')

    expect(queries.some(q => q.includes('DELETE FROM "plugin_field_value"') && q.includes('"deviceId" IS NOT NULL'))).toBe(true)
    expect(queries.some(q => q.includes('a."fieldId" = b."fieldId"'))).toBe(true)
  })

  it('removes the Device column and allows one Field Value per Plugin Field', async () => {
    const queries = await queriesOf(new FieldValuesBelongToPlugin1787190000002(), 'up')

    expect(queries.some(q => q.includes('DROP COLUMN "deviceId"'))).toBe(true)
    expect(queries.some(q => q.includes('UNIQUE ("fieldId")'))).toBe(true)
  })

  it('restores the Device column on the way down', async () => {
    const queries = await queriesOf(new FieldValuesBelongToPlugin1787190000002(), 'down')

    expect(queries.some(q => q.includes('DROP CONSTRAINT "REL_4ac249bde6572aaa58d9d7855c"'))).toBe(true)
    expect(queries.some(q => q.includes('ADD "deviceId" uuid'))).toBe(true)
  })

  it('adds select options to Plugin Fields, and drops them on the way down', async () => {
    const migration = new AddPluginFieldOptions1787190000003()

    expect(await queriesOf(migration, 'up')).toEqual([expect.stringContaining('"options" jsonb')])
    expect(await queriesOf(migration, 'down')).toEqual([expect.stringContaining('DROP COLUMN "options"')])
  })
})
