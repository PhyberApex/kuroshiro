import type { MockPluginDataFetcherService, MockPluginTransformService } from '../../test/mockPluginCollaborators.js'
import type { Plugin } from '../entities/plugin.entity.js'
import type { DataSourceFetchOutcomeService } from '../services/data-source-fetch-outcome.service.js'
import type { PluginDataFetcherService } from '../services/plugin-data-fetcher.service.js'
import type { PluginRenderCacheService } from '../services/plugin-render-cache.service.js'
import type { PluginTransformService } from '../services/plugin-transform.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makePlugin, makePluginDataSource, makePluginTemplate } from '../../test/fixtures.js'
import { createMockPluginDataFetcherService, createMockPluginTransformService, createPluginTemplateContextService } from '../../test/mockPluginCollaborators.js'
import { asService, callPrivate } from '../../test/mockService.js'
import { PluginDataResolverService } from '../services/plugin-data-resolver.service.js'
import { PluginRefreshService } from '../services/plugin-refresh.service.js'
import { PluginSchedulerService } from '../services/plugin-scheduler.service.js'

let capturedCallback: (() => Promise<void>) | undefined

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((_expression, callback) => {
      capturedCallback = callback
      return {
        start: vi.fn(),
        stop: vi.fn(),
      }
    }),
  },
}))

describe('pluginSchedulerService', () => {
  let service: PluginSchedulerService
  let mockDataFetcher: MockPluginDataFetcherService
  let mockTransformer: MockPluginTransformService
  let mockRenderCache: { renderAndCache: ReturnType<typeof vi.fn> }
  let mockFetchOutcome: { recordOutcomes: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    capturedCallback = undefined

    mockDataFetcher = createMockPluginDataFetcherService()
    mockTransformer = createMockPluginTransformService()

    mockRenderCache = {
      renderAndCache: vi.fn(),
    }
    mockFetchOutcome = {
      recordOutcomes: vi.fn().mockResolvedValue(undefined),
    }

    const pluginDataResolver = new PluginDataResolverService(
      asService<PluginDataFetcherService>(mockDataFetcher),
      asService<PluginTransformService>(mockTransformer),
    )

    service = new PluginSchedulerService(new PluginRefreshService(
      pluginDataResolver,
      asService<PluginRenderCacheService>(mockRenderCache),
      createPluginTemplateContextService(),
      asService<DataSourceFetchOutcomeService>(mockFetchOutcome),
    ))
  })

  it('schedules a plugin with refresh interval', () => {
    const plugin = makePlugin({
      id: 'plugin-1',
      refreshInterval: 15,
      dataSources: [makePluginDataSource({ name: 'source', url: 'https://api.example.com', method: 'GET' })],
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ data }}' })],
    })

    service.schedulePlugin(plugin)

    expect(service.hasScheduledJob('plugin-1')).toBe(true)
  })

  it('does not schedule inactive plugins', () => {
    const plugin = makePlugin({
      id: 'plugin-1',
      refreshInterval: 15,
    })

    service.schedulePlugin(plugin)

    expect(service.hasScheduledJob('plugin-1')).toBe(false)
  })

  it('removes a scheduled job', () => {
    const plugin = makePlugin({
      id: 'plugin-1',
      refreshInterval: 15,
      dataSources: [makePluginDataSource({ name: 'source', url: 'https://api.example.com', method: 'GET' })],
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ data }}' })],
    })

    service.schedulePlugin(plugin)
    expect(service.hasScheduledJob('plugin-1')).toBe(true)

    service.removeScheduledJob('plugin-1')
    expect(service.hasScheduledJob('plugin-1')).toBe(false)
  })

  it('converts refresh interval to cron expression', () => {
    expect(callPrivate<string>(service, 'getCronExpression', 1)).toBe('*/1 * * * *')
    expect(callPrivate<string>(service, 'getCronExpression', 15)).toBe('*/15 * * * *')
    expect(callPrivate<string>(service, 'getCronExpression', 30)).toBe('*/30 * * * *')
    expect(callPrivate<string>(service, 'getCronExpression', 60)).toBe('0 * * * *')
  })

  it('schedules multiple plugins independently', () => {
    const plugin1 = makePlugin({
      id: 'plugin-1',
      refreshInterval: 15,
      dataSources: [makePluginDataSource({ name: 'source', url: 'https://api1.com', method: 'GET' })],
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: 'Test 1' })],
    })

    const plugin2 = makePlugin({
      id: 'plugin-2',
      refreshInterval: 30,
      dataSources: [makePluginDataSource({ name: 'source', url: 'https://api2.com', method: 'GET' })],
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: 'Test 2' })],
    })

    service.schedulePlugin(plugin1)
    service.schedulePlugin(plugin2)

    expect(service.hasScheduledJob('plugin-1')).toBe(true)
    expect(service.hasScheduledJob('plugin-2')).toBe(true)
  })

  it('reschedules plugin after removal', () => {
    const plugin = makePlugin({
      id: 'plugin-1',
      refreshInterval: 15,
      dataSources: [makePluginDataSource({ name: 'source', url: 'https://api.com', method: 'GET' })],
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: 'Test' })],
    })

    service.schedulePlugin(plugin)
    expect(service.hasScheduledJob('plugin-1')).toBe(true)

    service.removeScheduledJob('plugin-1')
    expect(service.hasScheduledJob('plugin-1')).toBe(false)

    service.schedulePlugin(plugin)
    expect(service.hasScheduledJob('plugin-1')).toBe(true)
  })

  it('does not schedule if there are no data sources', () => {
    const plugin = makePlugin({
      id: 'plugin-1',
      refreshInterval: 15,
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: 'Test' })],
    })

    service.schedulePlugin(plugin)

    expect(service.hasScheduledJob('plugin-1')).toBe(false)
  })

  it('does not schedule a draft plugin with zero data sources', () => {
    const plugin = makePlugin({
      id: 'plugin-1',
      refreshInterval: 15,
      dataSources: [],
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: 'Test' })],
    })

    service.schedulePlugin(plugin)

    expect(service.hasScheduledJob('plugin-1')).toBe(false)
  })

  it('does not schedule if templates are missing', () => {
    const plugin = makePlugin({
      id: 'plugin-1',
      refreshInterval: 15,
      dataSources: [makePluginDataSource({ name: 'source', url: 'https://api.com', method: 'GET' })],
    })

    service.schedulePlugin(plugin)

    expect(service.hasScheduledJob('plugin-1')).toBe(false)
  })

  it('does not schedule Webhook-kind plugins', () => {
    const plugin = makePlugin({
      id: 'plugin-1',
      kind: 'Webhook',
      refreshInterval: 15,
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: 'Test' })],
    })

    service.schedulePlugin(plugin)

    expect(service.hasScheduledJob('plugin-1')).toBe(false)
  })

  describe('scheduled tick', () => {
    it('fetches all data sources in parallel and renders them under their own names', async () => {
      const plugin: Plugin = makePlugin({
        id: 'plugin-1',
        name: 'Multi Source',
        refreshInterval: 15,
        dataSources: [
          makePluginDataSource({ name: 'weather', url: 'https://api.example.com/weather', method: 'GET' }),
          makePluginDataSource({ name: 'air_quality', url: 'https://api.example.com/air', method: 'GET' }),
        ],
        templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ weather.temp }} / {{ air_quality.aqi }}' })],
      })

      let resolveWeather: (value: unknown) => void
      let resolveAirQuality: (value: unknown) => void
      const weatherPromise = new Promise((resolve) => {
        resolveWeather = resolve
      })
      const airQualityPromise = new Promise((resolve) => {
        resolveAirQuality = resolve
      })

      mockDataFetcher.fetchData.mockImplementation((_method: string, url: string) =>
        url.includes('weather') ? weatherPromise : airQualityPromise)
      mockRenderCache.renderAndCache.mockResolvedValue(undefined)

      service.schedulePlugin(plugin)
      const tickPromise = capturedCallback!()

      // Both fetches were started before either resolved — proof they run in parallel, not sequentially
      await vi.waitFor(() => expect(mockDataFetcher.fetchData).toHaveBeenCalledTimes(2))

      resolveAirQuality!({ aqi: 42 })
      resolveWeather!({ temp: 25 })
      await tickPromise

      expect(mockRenderCache.renderAndCache).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({ weather: { temp: 25 }, air_quality: { aqi: 42 } }),
      )
    })

    it('schedules a plugin with only literal-mode data sources and renders its stored value without calling the data fetcher', async () => {
      const plugin = makePlugin({
        id: 'plugin-1',
        name: 'Literal Only',
        refreshInterval: 15,
        dataSources: [
          makePluginDataSource({ name: 'source', mode: 'literal', literalValue: { title: 'Hello' } }),
        ],
        templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ source.title }}' })],
      })

      mockRenderCache.renderAndCache = vi.fn().mockResolvedValue(undefined)

      service.schedulePlugin(plugin)
      expect(service.hasScheduledJob('plugin-1')).toBe(true)

      await capturedCallback!()

      expect(mockDataFetcher.fetchData).not.toHaveBeenCalled()
      expect(mockRenderCache.renderAndCache).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({ source: { title: 'Hello' } }),
      )
    })

    it('renders a mixed plugin with one fetch and one literal source, without fetching the literal one', async () => {
      const plugin = makePlugin({
        id: 'plugin-1',
        name: 'Mixed',
        refreshInterval: 15,
        dataSources: [
          makePluginDataSource({ name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather', method: 'GET' }),
          makePluginDataSource({ name: 'title', mode: 'literal', literalValue: 'Static Title' }),
        ],
        templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ title }} {{ weather.temp }}' })],
      })

      mockDataFetcher.fetchData = vi.fn().mockResolvedValue({ temp: 25 })
      mockRenderCache.renderAndCache = vi.fn().mockResolvedValue(undefined)

      service.schedulePlugin(plugin)
      await capturedCallback!()

      expect(mockDataFetcher.fetchData).toHaveBeenCalledTimes(1)
      expect(mockRenderCache.renderAndCache).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({ weather: { temp: 25 }, title: 'Static Title' }),
      )
    })

    it('gives a failing fetch-mode source an error marker while a literal-mode source alongside it still renders normally', async () => {
      const plugin = makePlugin({
        id: 'plugin-1',
        name: 'Mixed Partial Failure',
        refreshInterval: 15,
        dataSources: [
          makePluginDataSource({ name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather', method: 'GET' }),
          makePluginDataSource({ name: 'title', mode: 'literal', literalValue: 'Static Title' }),
        ],
        templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ title }}' })],
      })

      mockDataFetcher.fetchData = vi.fn().mockRejectedValue(new Error('API timeout'))
      mockRenderCache.renderAndCache = vi.fn().mockResolvedValue(undefined)

      service.schedulePlugin(plugin)
      await capturedCallback!()

      expect(mockRenderCache.renderAndCache).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({
          weather: { error: true, message: 'API timeout' },
          title: 'Static Title',
        }),
      )
    })

    it('gives a failing data source an error marker and still renders the sources that succeeded', async () => {
      const plugin: Plugin = makePlugin({
        id: 'plugin-1',
        name: 'Partial Failure',
        refreshInterval: 15,
        dataSources: [
          makePluginDataSource({ name: 'weather', url: 'https://api.example.com/weather', method: 'GET' }),
          makePluginDataSource({ name: 'air_quality', url: 'https://api.example.com/air', method: 'GET' }),
        ],
        templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ weather.temp }}' })],
      })

      mockDataFetcher.fetchData.mockImplementation((_method: string, url: string) =>
        url.includes('weather')
          ? Promise.resolve({ temp: 25 })
          : Promise.reject(new Error('API timeout')))
      mockRenderCache.renderAndCache.mockResolvedValue(undefined)

      service.schedulePlugin(plugin)
      await capturedCallback!()

      expect(mockRenderCache.renderAndCache).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({
          weather: { temp: 25 },
          air_quality: { error: true, message: 'API timeout' },
        }),
      )
    })

    it('applies a data source\'s transformJs to the fetched value before rendering', async () => {
      const plugin = makePlugin({
        id: 'plugin-1',
        name: 'Transformed',
        refreshInterval: 15,
        dataSources: [
          makePluginDataSource({
            name: 'gh',
            mode: 'fetch',
            url: 'https://api.example.com/gh',
            method: 'GET',
            transformJs: 'return { totalShort: "3.5k" }',
          }),
        ],
        templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ gh.totalShort }}' })],
      })

      mockDataFetcher.fetchData.mockResolvedValue({ raw: 'graphql body' })
      mockTransformer.transform.mockReturnValue({ totalShort: '3.5k' })
      mockRenderCache.renderAndCache.mockResolvedValue(undefined)

      service.schedulePlugin(plugin)
      await capturedCallback!()

      expect(mockTransformer.transform).toHaveBeenCalledWith('return { totalShort: "3.5k" }', { raw: 'graphql body' })
      expect(mockRenderCache.renderAndCache).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({ gh: { totalShort: '3.5k' } }),
      )
    })

    it('gives a source an error marker when its transformJs throws, while a sibling source still renders', async () => {
      const plugin = makePlugin({
        id: 'plugin-1',
        name: 'Transform Failure',
        refreshInterval: 15,
        dataSources: [
          makePluginDataSource({
            name: 'gh',
            mode: 'fetch',
            url: 'https://api.example.com/gh',
            method: 'GET',
            transformJs: 'throw new Error("bad transform")',
          }),
          makePluginDataSource({ name: 'title', mode: 'literal', literalValue: 'Static Title' }),
        ],
        templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ title }}' })],
      })

      mockDataFetcher.fetchData.mockResolvedValue({ raw: 'graphql body' })
      mockTransformer.transform.mockImplementation(() => {
        throw new Error('bad transform')
      })
      mockRenderCache.renderAndCache.mockResolvedValue(undefined)

      service.schedulePlugin(plugin)
      await capturedCallback!()

      expect(mockRenderCache.renderAndCache).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({
          gh: { error: true, message: 'bad transform' },
          title: 'Static Title',
        }),
      )
    })

    it('records each data source\'s fetch outcome before rendering', async () => {
      const dataSources = [
        makePluginDataSource({ id: 'ds-1', name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather', method: 'GET' }),
      ]
      const plugin = makePlugin({
        id: 'plugin-1',
        refreshInterval: 15,
        dataSources,
        templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ weather }}' })],
      })

      mockDataFetcher.fetchData.mockResolvedValue({ temp: 25 })
      mockRenderCache.renderAndCache.mockResolvedValue(undefined)

      service.schedulePlugin(plugin)
      await capturedCallback!()

      expect(mockFetchOutcome.recordOutcomes).toHaveBeenCalledWith(dataSources, expect.objectContaining({ weather: { temp: 25 } }))
      expect(mockFetchOutcome.recordOutcomes.mock.invocationCallOrder[0])
        .toBeLessThan(mockRenderCache.renderAndCache.mock.invocationCallOrder[0])
    })

    it('still records the fetch outcome when the render itself throws', async () => {
      const dataSources = [
        makePluginDataSource({ id: 'ds-1', name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather', method: 'GET' }),
      ]
      const plugin = makePlugin({
        id: 'plugin-1',
        refreshInterval: 15,
        dataSources,
        templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ weather }}' })],
      })

      mockDataFetcher.fetchData.mockResolvedValue({ temp: 25 })
      mockRenderCache.renderAndCache.mockRejectedValue(new Error('render blew up'))

      service.schedulePlugin(plugin)
      await capturedCallback!()

      expect(mockFetchOutcome.recordOutcomes).toHaveBeenCalledWith(dataSources, expect.objectContaining({ weather: { temp: 25 } }))
    })
  })
})
