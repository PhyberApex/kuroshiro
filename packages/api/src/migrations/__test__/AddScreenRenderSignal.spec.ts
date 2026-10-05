import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddScreenRenderSignal1787270000000 } from '../1787270000000-AddScreenRenderSignal.js'

const SCREEN = '00000000-0000-4000-8000-000000000001'

describe('the Screen Render Signal migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddScreenRenderSignal1787270000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "screen" ("id" uuid PRIMARY KEY, "type" text NOT NULL)`)
    await queryRunner.query(`INSERT INTO "screen" ("id", "type") VALUES ('${SCREEN}', 'plugin')`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('leaves an existing Screen with no remembered verdict', async () => {
    await migration.up(queryRunner)

    const [screen] = await queryRunner.query(`SELECT * FROM "screen" WHERE "id" = '${SCREEN}'`)
    expect(screen.renderSignal).toBeNull()
  })

  it('stores the verdict once a render observes one', async () => {
    await migration.up(queryRunner)

    await queryRunner.query(`UPDATE "screen" SET "renderSignal" = 'skip' WHERE "id" = '${SCREEN}'`)
    const [screen] = await queryRunner.query(`SELECT * FROM "screen" WHERE "id" = '${SCREEN}'`)
    expect(screen.renderSignal).toBe('skip')
  })

  it('drops the column going down', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    await expect(queryRunner.query(`SELECT "renderSignal" FROM "screen"`)).rejects.toThrow()
  })
})
