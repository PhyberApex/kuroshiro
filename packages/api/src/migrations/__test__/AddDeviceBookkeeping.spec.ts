import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddDeviceBookkeeping1787200000000 } from '../1787200000000-AddDeviceBookkeeping.js'

const NEVER_POLLED = '00000000-0000-4000-8000-000000000001'
const POLLED = '00000000-0000-4000-8000-000000000002'
const REAL_DATE = '2026-09-30T08:15:00.000Z'

describe('the Device bookkeeping migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddDeviceBookkeeping1787200000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "device" ("id" uuid PRIMARY KEY, "lastSeen" timestamptz NOT NULL DEFAULT '2026-04-18T22:36:39.653Z')`)
    await queryRunner.query(`CREATE TABLE "alert" ("id" serial PRIMARY KEY, "kind" text NOT NULL, "deviceId" uuid)`)
    await queryRunner.query(`INSERT INTO "device" ("id") VALUES ('${NEVER_POLLED}')`)
    await queryRunner.query(`INSERT INTO "device" ("id", "lastSeen") VALUES ('${POLLED}', '${REAL_DATE}')`)
    await queryRunner.query(`INSERT INTO "alert" ("kind", "deviceId") VALUES ('device-offline', '${NEVER_POLLED}'), ('device-low-battery', '${NEVER_POLLED}'), ('device-offline', '${POLLED}')`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  async function lastSeenOf(id: string): Promise<Date | null> {
    const [row] = await queryRunner.query(`SELECT "lastSeen" FROM "device" WHERE "id" = '${id}'`)
    return row.lastSeen
  }

  it('turns the old placeholder date into NULL and leaves a real date untouched', async () => {
    await migration.up(queryRunner)

    expect(await lastSeenOf(NEVER_POLLED)).toBeNull()
    expect(new Date((await lastSeenOf(POLLED))!).toISOString()).toBe(REAL_DATE)
  })

  it('lets a new Device start without a last seen time or a last-served record', async () => {
    await migration.up(queryRunner)
    await queryRunner.query(`INSERT INTO "device" ("id") VALUES ('00000000-0000-4000-8000-000000000003')`)

    const [row] = await queryRunner.query(`SELECT * FROM "device" WHERE "id" = '00000000-0000-4000-8000-000000000003'`)

    expect(row).toMatchObject({
      lastSeen: null,
      lastServedAt: null,
      lastServedKind: null,
      lastServedScreenId: null,
      lastServedFallback: null,
      lastServedReason: null,
      lastServedRefreshRate: null,
      lastServedImagePath: null,
    })
  })

  it('removes the offline Alert the placeholder date opened, and no other Alert', async () => {
    await migration.up(queryRunner)

    const alerts = await queryRunner.query(`SELECT "kind", "deviceId" FROM "alert" ORDER BY "id"`)

    expect(alerts).toEqual([
      { kind: 'device-low-battery', deviceId: NEVER_POLLED },
      { kind: 'device-offline', deviceId: POLLED },
    ])
  })

  it('restores the placeholder date, the default and NOT NULL on the way down', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)
    await queryRunner.query(`INSERT INTO "device" ("id") VALUES ('00000000-0000-4000-8000-000000000003')`)

    const rows = await queryRunner.query(`SELECT * FROM "device" ORDER BY "id"`)

    expect(rows.map((row: { lastSeen: Date }) => new Date(row.lastSeen).toISOString())).toEqual(['2026-04-18T22:36:39.653Z', REAL_DATE, '2026-04-18T22:36:39.653Z'])
    expect(Object.keys(rows[0])).toEqual(['id', 'lastSeen'])
    await expect(queryRunner.query(`UPDATE "device" SET "lastSeen" = NULL`)).rejects.toThrow()
  })
})
