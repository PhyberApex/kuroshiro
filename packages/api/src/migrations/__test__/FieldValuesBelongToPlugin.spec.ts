import type { QueryRunner } from 'typeorm'
import { describe, expect, it, vi } from 'vitest'
import { FieldValuesBelongToPlugin1787190000000 } from '../1787190000000-FieldValuesBelongToPlugin.js'

async function queriesOf(direction: 'up' | 'down'): Promise<string[]> {
  const query = vi.fn().mockResolvedValue(undefined)
  await new FieldValuesBelongToPlugin1787190000000()[direction]({ query } as unknown as QueryRunner)
  return query.mock.calls.map(call => call[0] as string)
}

describe('fieldValuesBelongToPlugin1787190000000', () => {
  it('drops the Plugin Variable table', async () => {
    const queries = await queriesOf('up')

    expect(queries.some(q => q.includes('DROP TABLE') && q.includes('"plugin_variable"'))).toBe(true)
  })

  it('drops per-Device Field Values before removing the Device column and allowing one value per Plugin Field', async () => {
    const queries = await queriesOf('up')

    const deletePerDevice = queries.findIndex(q => q.includes('DELETE FROM "plugin_field_value"') && q.includes('"deviceId" IS NOT NULL'))
    const dropColumn = queries.findIndex(q => q.includes('DROP COLUMN "deviceId"'))
    const unique = queries.findIndex(q => q.includes('UNIQUE ("fieldId")'))

    expect(deletePerDevice).toBeGreaterThanOrEqual(0)
    expect(dropColumn).toBeGreaterThan(deletePerDevice)
    expect(unique).toBeGreaterThan(dropColumn)
  })

  it('adds select options to Plugin Fields', async () => {
    const queries = await queriesOf('up')

    expect(queries.some(q => q.includes('ALTER TABLE "plugin_field"') && q.includes('"options" jsonb'))).toBe(true)
  })

  it('reverses every up() change', async () => {
    const queries = await queriesOf('down')

    expect(queries.some(q => q.includes('DROP COLUMN "options"'))).toBe(true)
    expect(queries.some(q => q.includes('DROP CONSTRAINT "REL_4ac249bde6572aaa58d9d7855c"'))).toBe(true)
    expect(queries.some(q => q.includes('ADD "deviceId" uuid'))).toBe(true)
    expect(queries.some(q => q.includes('CREATE TABLE "plugin_variable"'))).toBe(true)
  })
})
