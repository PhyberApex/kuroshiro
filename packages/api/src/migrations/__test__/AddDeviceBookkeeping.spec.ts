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
    await queryRunner.query(`CREATE TABLE "device" ("id" uuid PRIMARY KEY, "refreshRate" integer NOT NULL DEFAULT 300, "mirrorEnabled" boolean, "lastSeen" timestamptz NOT NULL DEFAULT '2026-04-18T22:36:39.653Z')`)
    await queryRunner.query(`CREATE TABLE "screen" ("id" uuid PRIMARY KEY, "isActive" boolean NOT NULL, "deviceId" uuid)`)
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

  describe('a Device that polled before the record existed', () => {
    const ACTIVE_SCREEN = '00000000-0000-4000-8000-0000000000a1'

    async function recordOf(id: string): Promise<Record<string, unknown>> {
      const [{ lastServedAt, ...record }] = await queryRunner.query(`
        SELECT "lastServedAt", "lastServedKind", "lastServedScreenId", "lastServedFallback", "lastServedReason", "lastServedRefreshRate", "lastServedImagePath"
        FROM "device" WHERE "id" = '${id}'
      `)
      return { ...record, lastServedAt: new Date(lastServedAt).toISOString() }
    }

    it('is recorded as showing its Active Screen since it was last seen', async () => {
      await queryRunner.query(`INSERT INTO "screen" ("id", "isActive", "deviceId") VALUES ('${ACTIVE_SCREEN}', true, '${POLLED}'), ('00000000-0000-4000-8000-0000000000a2', false, '${POLLED}')`)

      await migration.up(queryRunner)

      expect(await recordOf(POLLED)).toEqual({
        lastServedAt: REAL_DATE,
        lastServedKind: 'screen',
        lastServedScreenId: ACTIVE_SCREEN,
        lastServedFallback: null,
        lastServedReason: null,
        lastServedRefreshRate: 300,
        lastServedImagePath: `/screens/devices/${POLLED}/${ACTIVE_SCREEN}.png`,
      })
    })

    it('is recorded as showing the mirrored image when it is mirrored', async () => {
      await queryRunner.query(`UPDATE "device" SET "mirrorEnabled" = true WHERE "id" = '${POLLED}'`)
      await queryRunner.query(`INSERT INTO "screen" ("id", "isActive", "deviceId") VALUES ('${ACTIVE_SCREEN}', true, '${POLLED}')`)

      await migration.up(queryRunner)

      expect(await recordOf(POLLED)).toMatchObject({ lastServedKind: 'mirror', lastServedScreenId: null, lastServedImagePath: `/screens/devices/${POLLED}/mirror.png` })
    })

    it('is recorded as showing the no-screen Fallback Screen when it has no Active Screen', async () => {
      await migration.up(queryRunner)
      expect(await recordOf(POLLED)).toMatchObject({ lastServedKind: 'fallback', lastServedFallback: 'noScreen', lastServedReason: 'noScreens', lastServedImagePath: '/screens/noScreen.png' })
    })

    it('says Rotation passed over its Screens when it has Screens and none is active', async () => {
      await queryRunner.query(`INSERT INTO "screen" ("id", "isActive", "deviceId") VALUES ('${ACTIVE_SCREEN}', false, '${POLLED}')`)

      await migration.up(queryRunner)

      expect(await recordOf(POLLED)).toMatchObject({ lastServedKind: 'fallback', lastServedFallback: 'noScreen', lastServedReason: 'noneEligible' })
    })

    it('leaves a Device that never polled without a record', async () => {
      await migration.up(queryRunner)

      const [row] = await queryRunner.query(`SELECT "lastServedAt", "lastServedKind" FROM "device" WHERE "id" = '${NEVER_POLLED}'`)

      expect(row).toEqual({ lastServedAt: null, lastServedKind: null })
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
    expect(Object.keys(rows[0])).toEqual(['id', 'refreshRate', 'mirrorEnabled', 'lastSeen'])
    await expect(queryRunner.query(`UPDATE "device" SET "lastSeen" = NULL`)).rejects.toThrow()
  })
})
