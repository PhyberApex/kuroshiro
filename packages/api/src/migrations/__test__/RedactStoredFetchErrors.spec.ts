import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RedactStoredFetchErrors1787280000000 } from '../1787280000000-RedactStoredFetchErrors.js'

const LEAKY_SOURCE = '00000000-0000-4000-8000-000000000001'
const CLEAN_SOURCE = '00000000-0000-4000-8000-000000000002'
const LEAKY_ALERT = '00000000-0000-4000-8000-000000000011'
const OTHER_ALERT = '00000000-0000-4000-8000-000000000012'

describe('the Redact Stored Fetch Errors migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new RedactStoredFetchErrors1787280000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "plugin_data_source" ("id" uuid PRIMARY KEY, "lastFetchError" text)`)
    await queryRunner.query(`CREATE TABLE "alert" ("id" uuid PRIMARY KEY, "kind" text NOT NULL, "details" jsonb)`)

    await queryRunner.query(`INSERT INTO "plugin_data_source" ("id", "lastFetchError") VALUES ('${LEAKY_SOURCE}', 'Failed to parse URL from not a url/s3cret')`)
    await queryRunner.query(`INSERT INTO "plugin_data_source" ("id", "lastFetchError") VALUES ('${CLEAN_SOURCE}', NULL)`)

    await queryRunner.query(`INSERT INTO "alert" ("id", "kind", "details") VALUES ('${LEAKY_ALERT}', 'data-source-fetch-failing', '{"streak": 3, "lastError": "s3cret leaked here"}')`)
    await queryRunner.query(`INSERT INTO "alert" ("id", "kind", "details") VALUES ('${OTHER_ALERT}', 'device-offline', '{"lastSeen": "2026-01-01T00:00:00.000Z"}')`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('clears every stored Fetch Error, so the next scheduled fetch writes it back hidden', async () => {
    await migration.up(queryRunner)

    const sources = await queryRunner.query(`SELECT "id", "lastFetchError" FROM "plugin_data_source" ORDER BY "id"`)
    expect(sources).toEqual([
      { id: LEAKY_SOURCE, lastFetchError: null },
      { id: CLEAN_SOURCE, lastFetchError: null },
    ])
  })

  it('clears details.lastError of a data-source-fetch-failing Alert, leaving the rest of its details alone', async () => {
    await migration.up(queryRunner)

    const [alert] = await queryRunner.query(`SELECT "details" FROM "alert" WHERE "id" = '${LEAKY_ALERT}'`)
    expect(alert.details).toEqual({ streak: 3, lastError: null })
  })

  it('never touches a device-offline Alert\'s details', async () => {
    await migration.up(queryRunner)

    const [alert] = await queryRunner.query(`SELECT "details" FROM "alert" WHERE "id" = '${OTHER_ALERT}'`)
    expect(alert.details).toEqual({ lastSeen: '2026-01-01T00:00:00.000Z' })
  })

  it('does nothing going down: a data-only migration leaves the clear in place', async () => {
    await migration.up(queryRunner)
    await migration.down()

    const [source] = await queryRunner.query(`SELECT "lastFetchError" FROM "plugin_data_source" WHERE "id" = '${LEAKY_SOURCE}'`)
    expect(source.lastFetchError).toBeNull()
  })
})
