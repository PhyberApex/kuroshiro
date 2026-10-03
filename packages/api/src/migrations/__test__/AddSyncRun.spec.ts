import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddSyncRun1787240000000 } from '../1787240000000-AddSyncRun.js'

describe('the sync record migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddSyncRun1787240000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "firmware" ("id" serial PRIMARY KEY, "kind" text NOT NULL, "syncedAt" timestamptz)`)
    await queryRunner.query(`CREATE TABLE "device_model" ("name" text PRIMARY KEY, "syncedAt" timestamptz)`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  async function records(): Promise<unknown[]> {
    const rows = await queryRunner.query(`SELECT "kind", "ranAt", "ok", "error" FROM "sync_run" ORDER BY "kind"`)
    return rows.map((row: { ranAt: Date }) => ({ ...row, ranAt: new Date(row.ranAt).toISOString() }))
  }

  it('starts an Instance that already holds Firmware and Device Models with the time of its newest synced rows', async () => {
    await queryRunner.query(`
      INSERT INTO "firmware" ("kind", "syncedAt") VALUES
        ('official-synced', '2026-09-01T04:00:00.000Z'),
        ('official-synced', '2026-09-20T04:00:00.000Z'),
        ('custom', NULL)
    `)
    await queryRunner.query(`INSERT INTO "device_model" ("name", "syncedAt") VALUES ('og_plus', '2026-09-25T04:00:00.000Z'), ('mine', NULL)`)

    await migration.up(queryRunner)

    expect(await records()).toEqual([
      { kind: 'device-models', ranAt: '2026-09-25T04:00:00.000Z', ok: true, error: null },
      { kind: 'firmware', ranAt: '2026-09-20T04:00:00.000Z', ok: true, error: null },
    ])
  })

  it('starts an Instance that never synced with no record', async () => {
    await queryRunner.query(`INSERT INTO "firmware" ("kind", "syncedAt") VALUES ('custom', NULL)`)

    await migration.up(queryRunner)

    expect(await records()).toEqual([])
  })

  it('drops the table on the way down', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    await expect(queryRunner.query(`SELECT 1 FROM "sync_run"`)).rejects.toThrow()
  })
})
