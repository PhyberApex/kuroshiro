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

  it('increments the streak and records the message for a source that resolved to an error marker', async () => {
    const source = makePluginDataSource({ id: 'ds-1', name: 'weather', mode: 'fetch', fetchFailureStreak: 2 })

    await service.recordOutcomes([source], { weather: { error: true, message: 'API timeout' } })

    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-1', {
      fetchFailureStreak: 3,
      lastFetchAttemptAt: expect.any(Date),
      lastFetchError: 'API timeout',
    })
  })

  it('resets the streak and clears the last error for a source that resolved successfully', async () => {
    const source = makePluginDataSource({ id: 'ds-1', name: 'weather', mode: 'fetch', fetchFailureStreak: 3, lastFetchError: 'previous failure' })

    await service.recordOutcomes([source], { weather: { temp: 25 } })

    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-1', {
      fetchFailureStreak: 0,
      lastFetchAttemptAt: expect.any(Date),
      lastFetchError: null,
    })
  })

  it('never touches a literal-mode source', async () => {
    const source = makePluginDataSource({ id: 'ds-1', name: 'title', mode: 'literal', fetchFailureStreak: 0 })

    await service.recordOutcomes([source], { title: 'Static Title' })

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

    expect(dataSourceRepo.update).toHaveBeenCalledTimes(2)
    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-1', expect.objectContaining({ fetchFailureStreak: 1 }))
    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-2', expect.objectContaining({ fetchFailureStreak: 0 }))
  })

  it('is a no-op given no data sources', async () => {
    await service.recordOutcomes([], {})
    expect(dataSourceRepo.update).not.toHaveBeenCalled()
  })
})
