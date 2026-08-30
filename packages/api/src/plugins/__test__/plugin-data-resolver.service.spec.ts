import type { PluginDataFetcherService } from '../services/plugin-data-fetcher.service'
import type { PluginTransformService } from '../services/plugin-transform.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makePlugin, makePluginDataSource } from '../../test/fixtures'
import { asService } from '../../test/mockService'
import { PluginDataResolverService } from '../services/plugin-data-resolver.service'

describe('pluginDataResolverService', () => {
  let service: PluginDataResolverService
  let pluginDataFetcher: { fetchOrLiteral: ReturnType<typeof vi.fn> }
  let pluginTransformer: { transform: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    pluginDataFetcher = { fetchOrLiteral: vi.fn() }
    pluginTransformer = { transform: vi.fn() }
    service = new PluginDataResolverService(
      asService<PluginDataFetcherService>(pluginDataFetcher),
      asService<PluginTransformService>(pluginTransformer),
    )
  })

  it('collects every data source under its own name', async () => {
    const plugin = makePlugin({
      dataSources: [
        makePluginDataSource({ name: 'weather', url: 'http://x/weather' }),
        makePluginDataSource({ name: 'calendar', url: 'http://x/calendar' }),
      ],
    })
    pluginDataFetcher.fetchOrLiteral
      .mockResolvedValueOnce({ temp: 72 })
      .mockResolvedValueOnce({ events: 3 })

    const data = await service.resolveDataSources(plugin, { trmnl: {} })

    expect(data).toEqual({ weather: { temp: 72 }, calendar: { events: 3 } })
  })

  it('applies transform.js to a source that declares it', async () => {
    const plugin = makePlugin({
      dataSources: [makePluginDataSource({ name: 'weather', transformJs: 'module.exports = (d) => d.temp' })],
    })
    pluginDataFetcher.fetchOrLiteral.mockResolvedValue({ temp: 72 })
    pluginTransformer.transform.mockReturnValue(72)

    const data = await service.resolveDataSources(plugin)

    expect(pluginTransformer.transform).toHaveBeenCalledWith('module.exports = (d) => d.temp', { temp: 72 })
    expect(data).toEqual({ weather: 72 })
  })

  it('gives a failing source an error marker instead of rejecting (ADR-0005)', async () => {
    const plugin = makePlugin({
      dataSources: [
        makePluginDataSource({ name: 'working' }),
        makePluginDataSource({ name: 'failing' }),
      ],
    })
    pluginDataFetcher.fetchOrLiteral
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('boom'))

    const data = await service.resolveDataSources(plugin)

    expect(data.working).toEqual({ ok: true })
    expect(data.failing).toEqual({ error: true, message: 'boom' })
  })
})
