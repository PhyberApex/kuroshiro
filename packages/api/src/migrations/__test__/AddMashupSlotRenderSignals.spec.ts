import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddMashupSlotRenderSignals1787410000000 } from '../1787410000000-AddMashupSlotRenderSignals.js'

const MASHUP_SCREEN = '00000000-0000-4000-8000-000000000001'
const PLUGIN_SCREEN = '00000000-0000-4000-8000-000000000002'
const CONFIGURATION = '00000000-0000-4000-8000-000000000003'
const SLOT = '00000000-0000-4000-8000-000000000004'

describe('the Mashup slot Render Signal migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddMashupSlotRenderSignals1787410000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "screen" ("id" uuid PRIMARY KEY, "type" text NOT NULL, "cachedPluginOutput" text, "renderSignal" text)`)
    await queryRunner.query(`CREATE TABLE "mashup_configuration" ("id" uuid PRIMARY KEY)`)
    await queryRunner.query(`CREATE TABLE "mashup_slot" ("id" uuid PRIMARY KEY)`)
    await queryRunner.query(`INSERT INTO "screen" VALUES ('${MASHUP_SCREEN}', 'mashup', '<div class="mashup"></div>', 'skip'), ('${PLUGIN_SCREEN}', 'plugin', '<p>cached</p>', 'hold')`)
    await queryRunner.query(`INSERT INTO "mashup_configuration" VALUES ('${CONFIGURATION}')`)
    await queryRunner.query(`INSERT INTO "mashup_slot" VALUES ('${SLOT}')`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('drops a Mashup\'s cached output and verdict so its next render writes its slots\' markup', async () => {
    await migration.up(queryRunner)

    const [screen] = await queryRunner.query(`SELECT * FROM "screen" WHERE "id" = '${MASHUP_SCREEN}'`)
    expect(screen.cachedPluginOutput).toBeNull()
    expect(screen.renderSignal).toBeNull()
  })

  it('leaves every other Screen\'s cached output and verdict alone', async () => {
    await migration.up(queryRunner)

    const [screen] = await queryRunner.query(`SELECT * FROM "screen" WHERE "id" = '${PLUGIN_SCREEN}'`)
    expect(screen.cachedPluginOutput).toBe('<p>cached</p>')
    expect(screen.renderSignal).toBe('hold')
  })

  it('leaves an existing slot with nothing stored and its Mashup with slot signals unread', async () => {
    await migration.up(queryRunner)

    const [slot] = await queryRunner.query(`SELECT * FROM "mashup_slot"`)
    expect(slot).toMatchObject({ renderedMarkup: null, liveMarkup: null, renderSignal: null })
    const [configuration] = await queryRunner.query(`SELECT * FROM "mashup_configuration"`)
    expect(configuration.slotSignalsRead).toBe(false)
  })

  it('drops the columns going down', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    await expect(queryRunner.query(`SELECT "liveMarkup" FROM "mashup_slot"`)).rejects.toThrow()
    await expect(queryRunner.query(`SELECT "slotSignalsRead" FROM "mashup_configuration"`)).rejects.toThrow()
  })
})
