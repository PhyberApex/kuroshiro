import type { ConfigService } from '@nestjs/config'
import type { PluginRendererService } from '../services/plugin-renderer.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makePluginDataSource } from '../../test/fixtures'
import { asService } from '../../test/mockService'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service'
import { PluginDataResolverService } from '../services/plugin-data-resolver.service'
import { PluginTransformService } from '../services/plugin-transform.service'

describe('pluginDataResolverService', () => {
  let service: PluginDataResolverService
  let dataFetcher: PluginDataFetcherService
  let transformer: PluginTransformService

  beforeEach(() => {
    dataFetcher = new PluginDataFetcherService(asService<PluginRendererService>({}), asService<ConfigService>({ get: vi.fn() }))
    transformer = new PluginTransformService()
    service = new PluginDataResolverService(dataFetcher, transformer)
  })

  it('resolves every data source in parallel, keyed by name', async () => {
    vi.spyOn(dataFetcher, 'fetchOrLiteral')
      .mockResolvedValueOnce({ temp: '72F' })
      .mockResolvedValueOnce({ count: 5 })

    const data = await service.resolveAll([
      makePluginDataSource({ name: 'weather' }),
      makePluginDataSource({ name: 'calendar' }),
    ])

    expect(data).toEqual({ weather: { temp: '72F' }, calendar: { count: 5 } })
  })

  it('applies transform.js to a source that has one', async () => {
    vi.spyOn(dataFetcher, 'fetchOrLiteral').mockResolvedValue({ raw: true })
    vi.spyOn(transformer, 'transform').mockReturnValue({ transformed: true })

    const data = await service.resolveAll([
      makePluginDataSource({ name: 'source', transformJs: 'module.exports = data => data' }),
    ])

    expect(transformer.transform).toHaveBeenCalledWith('module.exports = data => data', { raw: true })
    expect(data).toEqual({ source: { transformed: true } })
  })

  it('gives a failing source an error marker instead of rejecting the whole call (ADR-0005)', async () => {
    vi.spyOn(dataFetcher, 'fetchOrLiteral')
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('boom'))

    const data = await service.resolveAll([
      makePluginDataSource({ name: 'working' }),
      makePluginDataSource({ name: 'failing' }),
    ])

    expect(data).toEqual({
      working: { ok: true },
      failing: { error: true, message: 'boom' },
    })
  })

  it('resolves an empty array of data sources to an empty object', async () => {
    const data = await service.resolveAll([])
    expect(data).toEqual({})
  })
})
