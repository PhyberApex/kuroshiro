import type { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase } from '../../test/testDatabase.js'
import { SyncRun } from '../entities/sync-run.entity.js'
import { SyncRunService } from '../sync-run.service.js'

describe('the sync record', () => {
  let database: DataSource
  let service: SyncRunService

  beforeAll(async () => {
    database = await createTestDatabase()
    service = new SyncRunService(database.getRepository(SyncRun))
  }, 120_000)

  beforeEach(() => database.query(`TRUNCATE "sync_run"`))

  afterAll(() => database.destroy())

  it('has no record of a kind that never synced', async () => {
    expect(await service.last('firmware')).toBeNull()
  })

  it('keeps the latest sync of each kind apart from the other kind', async () => {
    await service.record('firmware', new Date('2026-10-01T04:00:00.000Z'), { ok: true })
    await service.record('device-models', new Date('2026-10-02T04:00:00.000Z'), { ok: false, error: 'TRMNL said 502' })
    await service.record('firmware', new Date('2026-10-03T04:00:00.000Z'), { ok: false, error: 'timed out' })

    expect(await service.last('firmware')).toEqual({ kind: 'firmware', ranAt: new Date('2026-10-03T04:00:00.000Z'), ok: false, error: 'timed out' })
    expect(await service.last('device-models')).toEqual({ kind: 'device-models', ranAt: new Date('2026-10-02T04:00:00.000Z'), ok: false, error: 'TRMNL said 502' })
  })

  it('clears the reason when a later sync works', async () => {
    await service.record('firmware', new Date('2026-10-01T04:00:00.000Z'), { ok: false, error: 'timed out' })
    await service.record('firmware', new Date('2026-10-02T04:00:00.000Z'), { ok: true })

    expect(await service.last('firmware')).toMatchObject({ ok: true, error: null })
  })
})
