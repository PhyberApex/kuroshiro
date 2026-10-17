import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddAlertReminders1787360000000 } from '../1787360000000-AddAlertReminders.js'

const ID = '00000000-0000-4000-8000-000000000001'

describe('the Alert reminders migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddAlertReminders1787360000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "alert" ("id" uuid PRIMARY KEY, "notifiedAt" timestamptz)`)
    await queryRunner.query(`CREATE TABLE "instance_settings" ("id" int PRIMARY KEY)`)
    await queryRunner.query(`INSERT INTO "alert" ("id", "notifiedAt") VALUES ('${ID}', now())`)
    await queryRunner.query(`INSERT INTO "instance_settings" ("id") VALUES (1)`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('leaves an existing Alert unreminded and the Reminder Interval unset', async () => {
    await migration.up(queryRunner)

    const [alert] = await queryRunner.query(`SELECT "remindedAt" FROM "alert" WHERE "id" = '${ID}'`)
    const [settings] = await queryRunner.query(`SELECT "alertReminderHours" FROM "instance_settings"`)
    expect(alert.remindedAt).toBeNull()
    expect(settings.alertReminderHours).toBeNull()
  })

  it('drops both columns again', async () => {
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    const [alert] = await queryRunner.query(`SELECT * FROM "alert" WHERE "id" = '${ID}'`)
    const [settings] = await queryRunner.query(`SELECT * FROM "instance_settings"`)
    expect(alert).not.toHaveProperty('remindedAt')
    expect(settings).not.toHaveProperty('alertReminderHours')
  })
})
