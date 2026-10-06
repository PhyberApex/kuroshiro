import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddDeviceResetNewApikey1787290000000 } from '../1787290000000-AddDeviceResetNewApikey.js'

const DEVICE = '00000000-0000-4000-8000-000000000001'

describe('the Device Reset new-apikey migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddDeviceResetNewApikey1787290000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "device" ("id" uuid PRIMARY KEY, "resetDevice" boolean NOT NULL DEFAULT false)`)
    await queryRunner.query(`INSERT INTO "device" ("id") VALUES ('${DEVICE}')`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('gives an existing Device the flag, off by default', async () => {
    await migration.up(queryRunner)

    const [device] = await queryRunner.query(`SELECT "resetDeviceNewApikey" FROM "device" WHERE "id" = '${DEVICE}'`)
    expect(device.resetDeviceNewApikey).toBe(false)
  })

  it('lets a new Device start without it set', async () => {
    await migration.up(queryRunner)
    await queryRunner.query(`INSERT INTO "device" ("id") VALUES ('00000000-0000-4000-8000-000000000002')`)

    const [device] = await queryRunner.query(`SELECT "resetDeviceNewApikey" FROM "device" WHERE "id" = '00000000-0000-4000-8000-000000000002'`)
    expect(device.resetDeviceNewApikey).toBe(false)
  })

  it('drops the column going down', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    await expect(queryRunner.query(`SELECT "resetDeviceNewApikey" FROM "device"`)).rejects.toThrow()
  })
})
