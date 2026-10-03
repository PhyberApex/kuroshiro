import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OneTemplatePerSize1787250000000 } from '../1787250000000-OneTemplatePerSize.js'

const ONLY_HALF = '00000000-0000-4000-8000-000000000001'
const TWO_FULL = '00000000-0000-4000-8000-000000000002'
const NO_FULL_TWICE = '00000000-0000-4000-8000-000000000003'
const IN_ORDER = '00000000-0000-4000-8000-000000000004'

describe('the one Template per size migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  let templateCount = 0
  const migration = new OneTemplatePerSize1787250000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "plugin_template" ("id" uuid PRIMARY KEY, "layout" text NOT NULL DEFAULT 'full', "liquidMarkup" text NOT NULL, "pluginId" uuid)`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  async function store(pluginId: string, layout: string, liquidMarkup: string): Promise<void> {
    templateCount += 1
    const id = `10000000-0000-4000-8000-${String(1000 - templateCount).padStart(12, '0')}`
    await queryRunner.query(`INSERT INTO "plugin_template" ("id", "layout", "liquidMarkup", "pluginId") VALUES ('${id}', '${layout}', '${liquidMarkup}', '${pluginId}')`)
  }

  async function templatesOf(pluginId: string): Promise<Array<{ layout: string, liquidMarkup: string }>> {
    return queryRunner.query(`SELECT "layout", "liquidMarkup" FROM "plugin_template" WHERE "pluginId" = '${pluginId}' ORDER BY "layout", "liquidMarkup"`)
  }

  it('makes the only Template of a Plugin without a full one its full Template', async () => {
    await store(ONLY_HALF, 'half_vertical', 'half')

    await migration.up(queryRunner)

    expect(await templatesOf(ONLY_HALF)).toEqual([{ layout: 'full', liquidMarkup: 'half' }])
  })

  it('keeps the earlier of two full Templates', async () => {
    await store(TWO_FULL, 'full', 'earlier')
    await store(TWO_FULL, 'full', 'later')

    await migration.up(queryRunner)

    expect(await templatesOf(TWO_FULL)).toEqual([{ layout: 'full', liquidMarkup: 'earlier' }])
  })

  it('makes the earliest Template full and keeps a later one of the same size', async () => {
    await store(NO_FULL_TWICE, 'quadrant', 'first quadrant')
    await store(NO_FULL_TWICE, 'quadrant', 'second quadrant')
    await store(NO_FULL_TWICE, 'half_vertical', 'half')

    await migration.up(queryRunner)

    expect(await templatesOf(NO_FULL_TWICE)).toEqual([
      { layout: 'full', liquidMarkup: 'first quadrant' },
      { layout: 'half_vertical', liquidMarkup: 'half' },
      { layout: 'quadrant', liquidMarkup: 'second quadrant' },
    ])
  })

  it('leaves a Plugin with one Template per size, full not first, as it is', async () => {
    await store(IN_ORDER, 'quadrant', 'quadrant')
    await store(IN_ORDER, 'full', 'full')
    await store(ONLY_HALF, 'full', 'another Plugin')

    await migration.up(queryRunner)

    expect(await templatesOf(IN_ORDER)).toEqual([
      { layout: 'full', liquidMarkup: 'full' },
      { layout: 'quadrant', liquidMarkup: 'quadrant' },
    ])
    expect(await templatesOf(ONLY_HALF)).toEqual([{ layout: 'full', liquidMarkup: 'another Plugin' }])
  })

  it('refuses a second Template of one size afterwards, and allows it again on the way down', async () => {
    await store(TWO_FULL, 'full', 'only')
    await migration.up(queryRunner)

    await expect(store(TWO_FULL, 'full', 'second')).rejects.toThrow(/UQ_plugin_template_plugin_layout/)

    await migration.down(queryRunner)
    await store(TWO_FULL, 'full', 'second')
    expect(await templatesOf(TWO_FULL)).toHaveLength(2)
  })
})
