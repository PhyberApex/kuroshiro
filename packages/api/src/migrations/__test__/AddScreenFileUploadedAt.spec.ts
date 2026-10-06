import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddScreenFileUploadedAt1787280000000 } from '../1787280000000-AddScreenFileUploadedAt.js'

const FILE_SCREEN = '00000000-0000-4000-8000-000000000001'
const HTML_SCREEN = '00000000-0000-4000-8000-000000000002'
const GENERATED_AT = '2026-03-01T09:30:00.000Z'

describe('the Screen file upload time migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddScreenFileUploadedAt1787280000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "screen" ("id" uuid PRIMARY KEY, "type" text NOT NULL, "generatedAt" timestamptz NOT NULL)`)
    await queryRunner.query(`INSERT INTO "screen" ("id", "type", "generatedAt") VALUES ('${FILE_SCREEN}', 'file', '${GENERATED_AT}'), ('${HTML_SCREEN}', 'html', '${GENERATED_AT}')`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('backfills an existing File Screen\'s upload time from its render time', async () => {
    await migration.up(queryRunner)

    const [screen] = await queryRunner.query(`SELECT "fileUploadedAt" FROM "screen" WHERE "id" = '${FILE_SCREEN}'`)
    expect(new Date(screen.fileUploadedAt)).toEqual(new Date(GENERATED_AT))
  })

  it('leaves a Screen of another kind without an upload time', async () => {
    await migration.up(queryRunner)

    const [screen] = await queryRunner.query(`SELECT "fileUploadedAt" FROM "screen" WHERE "id" = '${HTML_SCREEN}'`)
    expect(screen.fileUploadedAt).toBeNull()
  })

  it('drops the column going down', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    await expect(queryRunner.query(`SELECT "fileUploadedAt" FROM "screen"`)).rejects.toThrow()
  })
})
