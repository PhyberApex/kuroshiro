import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AddDeviceLogLevelAndMessage1787260000000 } from '../1787260000000-AddDeviceLogLevelAndMessage.js'

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

describe('the Device Log level and message migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new AddDeviceLogLevelAndMessage1787260000000()

  async function store(n: number, entry: string): Promise<void> {
    await queryRunner.query(`INSERT INTO "log_entry" ("id", "entry", "date", "logId") VALUES ($1, $2, '2026-09-30T09:00:00.000Z', $3)`, [uuid(n), entry, n])
  }

  async function stored(): Promise<Array<{ logId: number, level: string, message: string }>> {
    return queryRunner.query(`SELECT "logId", "level", "message" FROM "log_entry" ORDER BY "logId"`)
  }

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "log_entry" ("id" uuid PRIMARY KEY, "entry" text NOT NULL, "date" timestamptz NOT NULL, "logId" integer NOT NULL, "deviceId" uuid)`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  it('gives every existing entry the level and the message the ingest would have stored', async () => {
    await store(1, JSON.stringify({ id: 1, message: 'OTA aborted', level: 'fatal' }))
    await store(2, JSON.stringify({ id: 2, message: 'wifi reconnect took 9 s', level: 'warn' }))
    await store(3, JSON.stringify({ id: 3, message: 'heap after render', level: 'debug' }))
    await store(4, JSON.stringify({ log_id: 4, log_message: 'Failed to resolve hostname' }))
    await store(5, JSON.stringify({ log_id: 5, log_message: 'display poll' }))
    await store(6, 'not JSON at all')

    await migration.up(queryRunner)

    expect(await stored()).toEqual([
      { logId: 1, level: 'error', message: 'OTA aborted' },
      { logId: 2, level: 'warning', message: 'wifi reconnect took 9 s' },
      { logId: 3, level: 'debug', message: 'heap after render' },
      { logId: 4, level: 'error', message: 'Failed to resolve hostname' },
      { logId: 5, level: 'info', message: 'display poll' },
      { logId: 6, level: 'info', message: 'not JSON at all' },
    ])
  })

  it('backfills a Device Log longer than one batch', async () => {
    for (let n = 1; n <= 1203; n++)
      await store(n, JSON.stringify({ id: n, message: `poll ${n}`, level: 'info' }))

    await migration.up(queryRunner)

    const entries = await stored()
    expect(entries).toHaveLength(1203)
    expect(entries.every(entry => entry.level === 'info' && entry.message === `poll ${entry.logId}`)).toBe(true)
  })

  it('requires both columns of an entry stored afterwards', async () => {
    await migration.up(queryRunner)

    await expect(queryRunner.query(`INSERT INTO "log_entry" ("id", "entry", "date", "logId") VALUES ('${uuid(1)}', '{}', now(), 1)`)).rejects.toThrow()
  })

  it('takes the columns away again on the way down', async () => {
    await store(1, JSON.stringify({ id: 1, message: 'boot', level: 'info' }))
    await migration.up(queryRunner)
    await migration.down(queryRunner)

    const [entry] = await queryRunner.query(`SELECT * FROM "log_entry"`)
    expect(Object.keys(entry).sort()).toEqual(['date', 'deviceId', 'entry', 'id', 'logId'])
  })
})
