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

  it('loads the saved state of each stored Data Source by id, fresh from the database, and nothing for one that is not stored', async () => {
    dataSourceRepo.find.mockResolvedValue([{ id: 'ds-1', savedState: { cursor: 'abc' } }, { id: 'ds-2', savedState: null }] as PluginDataSource[])

    const states = await service.load([makePluginDataSource({ id: 'ds-1' }), makePluginDataSource({ id: 'ds-2' }), { name: 'unsaved' }])

    expect(dataSourceRepo.find).toHaveBeenCalledWith({ where: { id: expect.anything() }, select: { id: true, savedState: true } })
    expect(states).toEqual({ 'ds-1': { cursor: 'abc' } })
  })

  it('loads nothing without a stored Data Source, and asks the database nothing', async () => {
    expect(await service.load([{ name: 'unsaved' }])).toEqual({})
    expect(dataSourceRepo.find).not.toHaveBeenCalled()
  })

  it('saves the state a run wrote on the Data Source of that name, and leaves the others alone', async () => {
    const sources = [makePluginDataSource({ id: 'ds-1', name: 'a' }), makePluginDataSource({ id: 'ds-2', name: 'b' })]

    await service.save(sources, { a: { cursor: 'abc' } })

    expect(dataSourceRepo.update).toHaveBeenCalledTimes(1)
    expect(dataSourceRepo.update).toHaveBeenCalledWith('ds-1', { savedState: { cursor: 'abc' } })
  })
})
