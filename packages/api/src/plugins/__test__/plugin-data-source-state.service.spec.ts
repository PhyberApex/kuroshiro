import type { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { makePluginDataSource } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { PluginDataSourceStateService } from '../services/plugin-data-source-state.service.js'

describe('pluginDataSourceStateService', () => {
  let dataSourceRepo: ReturnType<typeof createMockRepository<PluginDataSource>>
  let service: PluginDataSourceStateService

  beforeEach(() => {
    dataSourceRepo = createMockRepository<PluginDataSource>()
    service = new PluginDataSourceStateService(asRepository(dataSourceRepo))
  })

  it('loads the saved state and the Previous Output of each stored Data Source by id, fresh from the database, and nothing for one that is not stored', async () => {
    dataSourceRepo.find.mockResolvedValue([
      makePluginDataSource({ id: 'ds-1', savedState: { cursor: 'abc' }, previousOutput: null }),
      makePluginDataSource({ id: 'ds-2', savedState: null, previousOutput: { plan: 'pro' } }),
    ])

    const loaded = await service.load([makePluginDataSource({ id: 'ds-1' }), makePluginDataSource({ id: 'ds-2' }), { name: 'unsaved' }])

    expect(dataSourceRepo.find).toHaveBeenCalledWith({ where: { id: expect.anything() }, select: { id: true, savedState: true, previousOutput: true } })
    expect(loaded).toEqual({ savedStates: { 'ds-1': { cursor: 'abc' } }, previousOutputs: { 'ds-2': { plan: 'pro' } } })
  })

  it('loads nothing without a stored Data Source, and asks the database nothing', async () => {
    expect(await service.load([{ name: 'unsaved' }])).toEqual({ savedStates: {}, previousOutputs: {} })
    expect(dataSourceRepo.find).not.toHaveBeenCalled()
  })

  it('saves the state and the output a run wrote on the Data Source of that name, and leaves the others alone', async () => {
    const sources = [makePluginDataSource({ id: 'ds-1', name: 'a' }), makePluginDataSource({ id: 'ds-2', name: 'b' }), makePluginDataSource({ id: 'ds-3', name: 'c' })]

    await service.save(sources, { states: { a: { cursor: 'abc' } }, outputs: { a: { price: 3 }, b: { price: 4 } } })

    expect(dataSourceRepo.update).toHaveBeenCalledTimes(2)
    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-1', { savedState: { cursor: 'abc' }, previousOutput: { price: 3 } })
    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-2', { previousOutput: { price: 4 } })
  })
})
