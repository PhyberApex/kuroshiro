import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddDevicePickedScreen1787300000000 } from '../1787300000000-AddDevicePickedScreen.js'

const DEVICE_ID = '00000000-0000-4000-8000-000000000001'
const SCREEN_ID = '00000000-0000-4000-8000-000000000002'

describe('the Device picked screen migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddDevicePickedScreen1787300000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "device" ("id" uuid PRIMARY KEY, "name" text NOT NULL)`)
    await queryRunner.query(`CREATE TABLE "screen" ("id" uuid PRIMARY KEY, "deviceId" uuid)`)
    await queryRunner.query(`INSERT INTO "device" ("id", "name") VALUES ('${DEVICE_ID}', 'Kitchen')`)
    await queryRunner.query(`INSERT INTO "screen" ("id", "deviceId") VALUES ('${SCREEN_ID}', '${DEVICE_ID}')`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('leaves an existing Device with no pick', async () => {
    await migration.up(queryRunner)

    const [device] = await queryRunner.query(`SELECT "pickedScreenId" FROM "device" WHERE "id" = '${DEVICE_ID}'`)
    expect(device.pickedScreenId).toBeNull()
  })

  it('accepts a pick naming one of the Device\'s Screens', async () => {
    await migration.up(queryRunner)

    await queryRunner.query(`UPDATE "device" SET "pickedScreenId" = '${SCREEN_ID}' WHERE "id" = '${DEVICE_ID}'`)

    const [device] = await queryRunner.query(`SELECT "pickedScreenId" FROM "device" WHERE "id" = '${DEVICE_ID}'`)
    expect(device.pickedScreenId).toBe(SCREEN_ID)
  })

  it('clears the pick once the picked Screen is deleted', async () => {
    await migration.up(queryRunner)
    await queryRunner.query(`UPDATE "device" SET "pickedScreenId" = '${SCREEN_ID}' WHERE "id" = '${DEVICE_ID}'`)

    await queryRunner.query(`DELETE FROM "screen" WHERE "id" = '${SCREEN_ID}'`)

    const [device] = await queryRunner.query(`SELECT "pickedScreenId" FROM "device" WHERE "id" = '${DEVICE_ID}'`)
    expect(device.pickedScreenId).toBeNull()
  })

  it('drops the column and the constraint going down', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    await expect(queryRunner.query(`SELECT "pickedScreenId" FROM "device"`)).rejects.toThrow()
  })
})
