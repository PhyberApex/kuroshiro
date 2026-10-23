import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OfficialFirmwarePerFolder1787400000000 } from '../1787400000000-OfficialFirmwarePerFolder.js'

describe('the official Firmware per folder migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new OfficialFirmwarePerFolder1787400000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "firmware" ("id" text PRIMARY KEY, "version" text NOT NULL, "kind" text NOT NULL, "deprecated" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_firmware_version" UNIQUE ("version"))`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  async function firmware(id: string, version: string, kind: string, folder?: string): Promise<void> {
    if (folder === undefined)
      await queryRunner.query(`INSERT INTO "firmware" ("id", "version", "kind") VALUES ('${id}', '${version}', '${kind}')`)
    else
      await queryRunner.query(`INSERT INTO "firmware" ("id", "version", "kind", "folder") VALUES ('${id}', '${version}', '${kind}', '${folder}')`)
  }

  it('keeps every official row as trmnl_og and leaves custom rows without a folder', async () => {
    await firmware('old', '1.8.16', 'official-synced')
    await firmware('new', '1.8.17', 'official-synced')
    await firmware('mine', '1.9.0-rc', 'custom')

    await migration.up(queryRunner)

    expect(await queryRunner.query(`SELECT "id", "folder" FROM "firmware" ORDER BY "id"`)).toEqual([
      { id: 'mine', folder: null },
      { id: 'new', folder: 'trmnl_og' },
      { id: 'old', folder: 'trmnl_og' },
    ])
  })

  it('takes one official row per folder of a version, and refuses a second in the same folder', async () => {
    await firmware('og', '1.8.17', 'official-synced')
    await migration.up(queryRunner)

    await firmware('x', '1.8.17', 'official-synced', 'trmnl_x')
    await expect(firmware('og-again', '1.8.17', 'official-synced', 'trmnl_og')).rejects.toThrow(/UQ_firmware_folder_version/)
  })

  it('still refuses a second custom row of a version', async () => {
    await migration.up(queryRunner)
    await firmware('mine', '2.0.0', 'custom')

    await expect(firmware('mine-again', '2.0.0', 'custom')).rejects.toThrow(/UQ_firmware_custom_version/)
  })

  it('puts the version-wide constraint back on down', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    await firmware('og', '1.8.17', 'official-synced')
    await expect(firmware('custom', '1.8.17', 'custom')).rejects.toThrow(/UQ_firmware_version/)
  })
})
