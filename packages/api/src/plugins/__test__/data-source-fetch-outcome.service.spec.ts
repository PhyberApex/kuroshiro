import type { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { makePluginDataSource } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { DataSourceFetchOutcomeService } from '../services/data-source-fetch-outcome.service.js'

describe('dataSourceFetchOutcomeService', () => {
  let dataSourceRepo: ReturnType<typeof createMockRepository<PluginDataSource>>
  let service: DataSourceFetchOutcomeService

  beforeEach(() => {
    dataSourceRepo = createMockRepository<PluginDataSource>()
    service = new DataSourceFetchOutcomeService(asRepository(dataSourceRepo))
  })

  it('increments the streak at the database and records the message for a source that resolved to an error marker', async () => {
    // fetchFailureStreak is deliberately stale here — the scheduler's cron
    // closure never refreshes it tick over tick, so the increment must not
    // be computed from this value (see the service's doc comment).
    const source = makePluginDataSource({ id: 'ds-1', name: 'weather', mode: 'fetch', fetchFailureStreak: 2 })

    await service.recordOutcomes([source], { weather: { error: true, message: 'API timeout' } })

    expect(dataSourceRepo.increment).toHaveBeenCalledWith({ id: 'ds-1' }, 'fetchFailureStreak', 1)
    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-1', {
      lastFetchAttemptAt: expect.any(Date),
      lastFetchError: 'API timeout',
    })
  })

  it('resets the streak and clears the last error for a source that resolved successfully', async () => {
    const source = makePluginDataSource({ id: 'ds-1', name: 'weather', mode: 'fetch', fetchFailureStreak: 3, lastFetchError: 'previous failure' })

    await service.recordOutcomes([source], { weather: { temp: 25 } })

    expect(dataSourceRepo.increment).not.toHaveBeenCalled()
    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-1', {
      fetchFailureStreak: 0,
      lastFetchAttemptAt: expect.any(Date),
      lastFetchSucceededAt: expect.any(Date),
      lastFetchError: null,
    })
  })

  it('counts a multi-line source whose every line failed as a failed fetch, naming each line (ADR-0058)', async () => {
    const source = makePluginDataSource({ id: 'ds-1', name: 'weather', mode: 'fetch' })

    await service.recordOutcomes([source], {
      weather: { IDX_0: { error: true, message: 'fetch failed' }, IDX_1: { error: true, message: 'HTTP error! status: 503' } },
    })

    expect(dataSourceRepo.increment).toHaveBeenCalledWith({ id: 'ds-1' }, 'fetchFailureStreak', 1)
    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-1', {
      lastFetchAttemptAt: expect.any(Date),
      lastFetchError: 'IDX_0: fetch failed\nIDX_1: HTTP error! status: 503',
    })
  })

  it('counts a multi-line source with one failed line as a failed fetch, naming only that line', async () => {
    const source = makePluginDataSource({ id: 'ds-1', name: 'weather', mode: 'fetch' })

    await service.recordOutcomes([source], {
      weather: { IDX_0: { temp: 25 }, IDX_1: { error: true, message: 'HTTP error! status: 404' } },
    })

    expect(dataSourceRepo.increment).toHaveBeenCalledWith({ id: 'ds-1' }, 'fetchFailureStreak', 1)
    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-1', {
      lastFetchAttemptAt: expect.any(Date),
      lastFetchError: 'IDX_1: HTTP error! status: 404',
    })
  })

  it('resets the streak for a multi-line source whose every line succeeded', async () => {
    const source = makePluginDataSource({ id: 'ds-1', name: 'weather', mode: 'fetch', fetchFailureStreak: 2 })

    await service.recordOutcomes([source], { weather: { IDX_0: { temp: 25 }, IDX_1: { data: [1, 2] } } })

    expect(dataSourceRepo.increment).not.toHaveBeenCalled()
    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-1', expect.objectContaining({ fetchFailureStreak: 0, lastFetchError: null }))
  })

  it('reads a key that only looks like a line index on an ordinary response as data', async () => {
    const source = makePluginDataSource({ id: 'ds-1', name: 'weather', mode: 'fetch' })

    await service.recordOutcomes([source], { weather: { IDX_0: { error: true, message: 'upstream says so' }, temp: 25 } })

    expect(dataSourceRepo.increment).not.toHaveBeenCalled()
  })

  it('never touches a literal-mode source', async () => {
    const source = makePluginDataSource({ id: 'ds-1', name: 'title', mode: 'literal', fetchFailureStreak: 0 })

    await service.recordOutcomes([source], { title: 'Static Title' })

    expect(dataSourceRepo.increment).not.toHaveBeenCalled()
    expect(dataSourceRepo.update).not.toHaveBeenCalled()
  })

  it('records each source in a mixed batch independently', async () => {
    const failing = makePluginDataSource({ id: 'ds-1', name: 'weather', mode: 'fetch', fetchFailureStreak: 0 })
    const succeeding = makePluginDataSource({ id: 'ds-2', name: 'air_quality', mode: 'fetch', fetchFailureStreak: 5 })
    const literal = makePluginDataSource({ id: 'ds-3', name: 'title', mode: 'literal' })

    await service.recordOutcomes([failing, succeeding, literal], {
      weather: { error: true, message: 'timeout' },
      air_quality: { aqi: 42 },
      title: 'Static Title',
    })

    expect(dataSourceRepo.increment).toHaveBeenCalledTimes(1)
    expect(dataSourceRepo.increment).toHaveBeenCalledWith({ id: 'ds-1' }, 'fetchFailureStreak', 1)
    expect(dataSourceRepo.update).toHaveBeenCalledTimes(2)
    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-1', expect.objectContaining({ lastFetchError: 'timeout' }))
    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-2', expect.objectContaining({ fetchFailureStreak: 0 }))
  })

  it('is a no-op given no data sources', async () => {
    await service.recordOutcomes([], {})
    expect(dataSourceRepo.increment).not.toHaveBeenCalled()
    expect(dataSourceRepo.update).not.toHaveBeenCalled()
  })

  it('never derives the increment from the (possibly stale) in-memory streak value', async () => {
    const source = makePluginDataSource({ id: 'ds-1', name: 'weather', mode: 'fetch', fetchFailureStreak: 999 })

    await service.recordOutcomes([source], { weather: { error: true, message: 'still failing' } })

    // Always +1 at the database, regardless of what the stale in-memory copy says.
    expect(dataSourceRepo.increment).toHaveBeenCalledWith({ id: 'ds-1' }, 'fetchFailureStreak', 1)
  })
})
