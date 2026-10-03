import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddPluginReadFacts1787230000000 } from '../1787230000000-AddPluginReadFacts.js'

const PLUGIN = '00000000-0000-4000-8000-000000000001'
const DATA_SOURCE = '00000000-0000-4000-8000-000000000002'

describe('the Plugin read facts migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddPluginReadFacts1787230000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "plugin" ("id" uuid PRIMARY KEY, "name" text NOT NULL, "sourceRecipeSnapshot" jsonb, "webhookPayload" jsonb)`)
    await queryRunner.query(`CREATE TABLE "plugin_data_source" ("id" uuid PRIMARY KEY, "name" text NOT NULL, "lastFetchAttemptAt" timestamptz, "pluginId" uuid)`)
    await queryRunner.query(`INSERT INTO "plugin" ("id", "name", "sourceRecipeSnapshot", "webhookPayload") VALUES ('${PLUGIN}', 'Weather', '{"name":"Weather Recipe"}', '{"reading":4}')`)
    await queryRunner.query(`INSERT INTO "plugin_data_source" ("id", "name", "lastFetchAttemptAt", "pluginId") VALUES ('${DATA_SOURCE}', 'weather', '2026-09-30T08:15:00.000Z', '${PLUGIN}')`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('leaves every new fact of an existing Plugin and Data Source empty, since none was recorded', async () => {
    await migration.up(queryRunner)

    const [plugin] = await queryRunner.query(`SELECT * FROM "plugin" WHERE "id" = '${PLUGIN}'`)
    const [source] = await queryRunner.query(`SELECT * FROM "plugin_data_source" WHERE "id" = '${DATA_SOURCE}'`)

    expect(plugin).toMatchObject({
      name: 'Weather',
      sourceRecipeSnapshot: { name: 'Weather Recipe' },
      payloadReceivedAt: null,
      snapshotTakenAt: null,
      lastScheduledRenderAt: null,
      lastScheduledRenderError: null,
      lastScheduledRenderErrorLine: null,
      lastScheduledRenderErrorSize: null,
    })
    expect(source.lastFetchSucceededAt).toBeNull()
    expect(new Date(source.lastFetchAttemptAt).toISOString()).toBe('2026-09-30T08:15:00.000Z')
  })

  it('stores the facts once they are written', async () => {
    await migration.up(queryRunner)

    await queryRunner.query(`UPDATE "plugin" SET "payloadReceivedAt" = '2026-10-01T10:00:00.000Z', "lastScheduledRenderAt" = '2026-10-01T10:15:00.000Z', "lastScheduledRenderError" = 'unknown tag', "lastScheduledRenderErrorLine" = 12, "lastScheduledRenderErrorSize" = 'quadrant'`)
    await queryRunner.query(`UPDATE "plugin_data_source" SET "lastFetchSucceededAt" = '2026-10-01T10:15:00.000Z'`)
    const [plugin] = await queryRunner.query(`SELECT * FROM "plugin"`)
    const [source] = await queryRunner.query(`SELECT * FROM "plugin_data_source"`)

    expect(plugin).toMatchObject({ lastScheduledRenderError: 'unknown tag', lastScheduledRenderErrorLine: 12, lastScheduledRenderErrorSize: 'quadrant' })
    expect(new Date(plugin.payloadReceivedAt).toISOString()).toBe('2026-10-01T10:00:00.000Z')
    expect(new Date(source.lastFetchSucceededAt).toISOString()).toBe('2026-10-01T10:15:00.000Z')
  })

  it('takes the columns away again on the way down', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    const [plugin] = await queryRunner.query(`SELECT * FROM "plugin"`)
    const [source] = await queryRunner.query(`SELECT * FROM "plugin_data_source"`)

    expect(Object.keys(plugin).sort()).toEqual(['id', 'name', 'sourceRecipeSnapshot', 'webhookPayload'])
    expect(Object.keys(source).sort()).toEqual(['id', 'lastFetchAttemptAt', 'name', 'pluginId'])
  })
})
