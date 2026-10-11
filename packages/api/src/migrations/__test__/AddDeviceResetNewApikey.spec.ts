import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddDeviceResetNewApikey1787300000000 } from '../1787300000000-AddDeviceResetNewApikey.js'

const DEVICE_ID = '00000000-0000-4000-8000-000000000001'

describe('the Device reset-new-apikey migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddDeviceResetNewApikey1787300000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "device" ("id" uuid PRIMARY KEY, "name" text NOT NULL)`)
    await queryRunner.query(`INSERT INTO "device" ("id", "name") VALUES ('${DEVICE_ID}', 'Kitchen')`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('leaves an existing Device without a pending rotation', async () => {
    await migration.up(queryRunner)

    const [device] = await queryRunner.query(`SELECT "resetDeviceNewApikey" FROM "device" WHERE "id" = '${DEVICE_ID}'`)
    expect(device.resetDeviceNewApikey).toBe(false)
  })

  it('accepts true once added', async () => {
    await migration.up(queryRunner)

    await queryRunner.query(`UPDATE "device" SET "resetDeviceNewApikey" = true WHERE "id" = '${DEVICE_ID}'`)

    const [device] = await queryRunner.query(`SELECT "resetDeviceNewApikey" FROM "device" WHERE "id" = '${DEVICE_ID}'`)
    expect(device.resetDeviceNewApikey).toBe(true)
  })

  it('drops the column going down', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    await expect(queryRunner.query(`SELECT "resetDeviceNewApikey" FROM "device"`)).rejects.toThrow()
  })
})
