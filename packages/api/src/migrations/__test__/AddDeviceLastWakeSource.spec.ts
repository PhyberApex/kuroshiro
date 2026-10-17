import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddDeviceLastWakeSource1787330000000 } from '../1787330000000-AddDeviceLastWakeSource.js'

const ID = '00000000-0000-4000-8000-000000000001'

describe('the last wake source migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddDeviceLastWakeSource1787330000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "device" ("id" uuid PRIMARY KEY)`)
    await queryRunner.query(`INSERT INTO "device" ("id") VALUES ('${ID}')`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('leaves an existing Device with no wake source', async () => {
    await migration.up(queryRunner)

    const [device] = await queryRunner.query(`SELECT "lastWakeSource" FROM "device" WHERE "id" = '${ID}'`)
    expect(device.lastWakeSource).toBeNull()
  })

  it('drops the column again', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    const [device] = await queryRunner.query(`SELECT * FROM "device" WHERE "id" = '${ID}'`)
    expect(device).not.toHaveProperty('lastWakeSource')
  })
})
