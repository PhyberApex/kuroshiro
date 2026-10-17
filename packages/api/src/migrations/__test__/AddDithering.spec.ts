import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddDithering1787320000000 } from '../1787320000000-AddDithering.js'

const ID = '00000000-0000-4000-8000-000000000001'

describe('the Dithering migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddDithering1787320000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "plugin" ("id" uuid PRIMARY KEY, "name" text NOT NULL)`)
    await queryRunner.query(`CREATE TABLE "screen" ("id" uuid PRIMARY KEY)`)
    await queryRunner.query(`INSERT INTO "plugin" ("id", "name") VALUES ('${ID}', 'Weather')`)
    await queryRunner.query(`INSERT INTO "screen" ("id") VALUES ('${ID}')`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('leaves an existing Plugin dithered', async () => {
    await migration.up(queryRunner)

    const [plugin] = await queryRunner.query(`SELECT "dither" FROM "plugin" WHERE "id" = '${ID}'`)
    expect(plugin.dither).toBe(true)
  })

  it('leaves an existing Screen dithered', async () => {
    await migration.up(queryRunner)

    const [screen] = await queryRunner.query(`SELECT "dither" FROM "screen" WHERE "id" = '${ID}'`)
    expect(screen.dither).toBe(true)
  })

  it('drops both columns going down', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    await expect(queryRunner.query(`SELECT "dither" FROM "plugin"`)).rejects.toThrow()
    await expect(queryRunner.query(`SELECT "dither" FROM "screen"`)).rejects.toThrow()
  })
})
