import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddPluginFrameworkVersion1787310000000 } from '../1787310000000-AddPluginFrameworkVersion.js'

const PLUGIN_ID = '00000000-0000-4000-8000-000000000001'

describe('the Plugin Framework Version migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddPluginFrameworkVersion1787310000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "plugin" ("id" uuid PRIMARY KEY, "name" text NOT NULL)`)
    await queryRunner.query(`INSERT INTO "plugin" ("id", "name") VALUES ('${PLUGIN_ID}', 'Weather')`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('leaves an existing Plugin on the Instance pin', async () => {
    await migration.up(queryRunner)

    const [plugin] = await queryRunner.query(`SELECT "frameworkVersion" FROM "plugin" WHERE "id" = '${PLUGIN_ID}'`)
    expect(plugin.frameworkVersion).toBeNull()
  })

  it('accepts a version once added', async () => {
    await migration.up(queryRunner)

    await queryRunner.query(`UPDATE "plugin" SET "frameworkVersion" = '3.3.1' WHERE "id" = '${PLUGIN_ID}'`)

    const [plugin] = await queryRunner.query(`SELECT "frameworkVersion" FROM "plugin" WHERE "id" = '${PLUGIN_ID}'`)
    expect(plugin.frameworkVersion).toBe('3.3.1')
  })

  it('drops the column going down', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    await expect(queryRunner.query(`SELECT "frameworkVersion" FROM "plugin"`)).rejects.toThrow()
  })
})
